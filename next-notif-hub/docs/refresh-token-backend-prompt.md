# Prompt for the nest-notif-hub backend session

Paste everything below the line into the Claude session working in `nest-notif-hub`.

---

Add a token-refresh endpoint to the auth module. Right now `POST /auth/login` and `GET /auth/oidc/callback` both return `{ accessToken, refreshToken, tokenType }`, but there's no way to exchange that `refreshToken` for a new `accessToken` once it expires — the frontend just found this gap while wiring up session persistence and needs it to stop forcing a full re-login on every access-token expiry.

Context you need (I already traced this in the code, so build on it rather than re-discovering):

- The `refreshToken` returned to clients is **not** an EDEN-issued token — it's Authentik's own OAuth2 refresh token, passed straight through from `AuthentikService.login()`'s `TokenResponse.refresh_token`. EDEN's `accessToken` is a separate JWT that `AuthService.generateJwt()` mints itself from EDEN's own `UserEntity`.
- `AuthentikService` (`src/infrastructure/authentik/authentik.service.ts`) has `login()` (full code-exchange flow via a scraped login form + `/application/o/token/` with `grant_type=authorization_code`) and `userInfo(accessToken)` (calls `/application/o/userinfo/`), but no method that does a `grant_type=refresh_token` exchange.
- `AuthService.loginWithPassword()` and `loginWithOidc()` (`src/auth/auth.service.ts`) both follow the same shape: get an Authentik token → `userInfo()` → `resolveUser()` (looks up the EDEN account by `sub`, throws `BusinessException('ACCOUNT_NOT_PROVISIONED', ...)` if none exists — closed provisioning, no auto-creation) → `generateJwt(user)` → return `LoginResult`.

Implement:

1. **`AuthentikService`** — add `refresh(refreshToken: string): Promise<TokenResponse>`. POST to `/application/o/token/` (same base URL pattern as `exchangeSessionForTokens`) with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`, `Content-Type: application/x-www-form-urlencoded` — mirror the existing token POST in `exchangeSessionForTokens()`. On a non-2xx response, throw `BusinessException('AUTHENTIK_ERROR', ..., HttpStatus.BAD_GATEWAY)` matching the existing error style in this file. Note Authentik may or may not rotate the refresh token on each use (depends on the provider's `refresh_token` grant config) — return whatever `refresh_token` comes back in the response (fall back to the input token only if the response genuinely omits one, don't assume).

2. **`AuthService`** — add `refresh(refreshToken: string): Promise<LoginResult>`: call `authentikService.refresh(refreshToken)` → `authentikService.userInfo(newAccessToken)` → `resolveUser(profile)` (reuse as-is, including its `ACCOUNT_NOT_PROVISIONED` guard — an account could theoretically get deprovisioned between logins) → `generateJwt(user)` → return `{ accessToken: newEdenJwt, refreshToken: <from step 1>, tokenType: 'Bearer' }`, same shape as `loginWithPassword`.

3. **DTO** — `src/auth/dto/refresh.dto.ts`, matching `login.dto.ts`'s style:
   ```ts
   export class RefreshDto {
     @IsString()
     @IsNotEmpty()
     refreshToken: string;
   }
   ```

4. **`AuthController`** — add:
   ```ts
   @Post('refresh')
   async refresh(@Body() dto: RefreshDto) {
     return this.authService.refresh(dto.refreshToken);
   }
   ```

Response contract must stay `{ accessToken: string, refreshToken: string, tokenType: string }` — the frontend's `apiFetch<Payload, Response>` generic + `LoginResponse` type already assume this exact shape for `/auth/login` and will reuse it verbatim for `/auth/refresh`.

One thing to flag back to me rather than silently deciding: what should happen when the refresh token itself is expired/invalid (Authentik will presumably 400 on the token endpoint)? I'd expect a `401` with a clear `errorCode` (e.g. `INVALID_REFRESH_TOKEN`) so the frontend can distinguish "needs a full re-login" from other failure modes — but confirm that's how `BusinessException`'s status mapping actually surfaces it before assuming.

Also — no CORS config changes needed for this specifically, but since the frontend is on a different origin (`localhost:3000` → `localhost:8080`), double check `POST /auth/refresh` isn't blocked by whatever CORS setup exists for `/auth/login` today (should be automatic if it's the same global config, just flagging in case `/auth/*` isn't covered as a whole).
