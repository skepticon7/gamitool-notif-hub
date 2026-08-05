import { HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../shared/exceptions/business.exception';
import {
  ExecutorChallenge,
  TokenResponse,
  UserInfoResponse,
} from './types/authentik.interfaces';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { OidcProfile } from '../../auth/types/auth.interfaces';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthentikService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  // Admin API (API_TOKEN), separate from the OIDC client used everywhere else
  // in this service — this creates the account, it doesn't authenticate anyone.
  private adminClient(): AxiosInstance {
    return axios.create({
      baseURL: this.configService.getOrThrow<string>('AUTHENTIK_URL'),
      headers: {
        Authorization: `Bearer ${this.configService.getOrThrow<string>('API_TOKEN')}`,
      },
      validateStatus: () => true,
    });
  }

  // Creates the Authentik account only — no Authentik group is assigned here.
  // Role/authorization lives solely in EDEN's own UserEntity.role (see
  // AuthService.generateJwt); Authentik's job stops at proving identity.
  //
  // The returned `sub` is Authentik's user `uuid` — this provider's OAuth2
  // config has sub_mode: 'user_uuid' (verified via GET /api/v3/providers/oauth2/),
  // so `uuid` is what actually lands in the `sub` claim at login time, not `pk`.
  async createUser(email: string, name: string): Promise<{ sub: string; temporaryPassword: string }> {
    const client = this.adminClient();

    const createRes = await client.post('/api/v3/core/users/', {
      username: email,
      name,
      email,
      is_active: true,
    });

    if (createRes.status !== 201) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        `Failed to create Authentik user: ${JSON.stringify(createRes.data)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const authentikUserId = createRes.data.pk;
    const authentikUserUuid = createRes.data.uuid;
    const temporaryPassword = randomBytes(9).toString('base64url');

    const pwRes = await client.post(`/api/v3/core/users/${authentikUserId}/set_password/`, {
      password: temporaryPassword,
    });

    if (pwRes.status !== 200 && pwRes.status !== 204) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        `Failed to set password for Authentik user: ${JSON.stringify(pwRes.data)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      sub: authentikUserUuid,
      temporaryPassword,
    };
  }

  private client(): AxiosInstance {
    const jar = new CookieJar();
    const instance = wrapper(
      axios.create({
        baseURL: 'http://localhost:9000',
        jar,
        withCredentials: true,
        validateStatus: () => true,
      } as any),
    );
    return instance;
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const client = this.client();
    const flowSlug = this.configService.getOrThrow<string>(
      'AUTHENTIK_LOGIN_FLOW_SLUG',
    );

    const start = await client.get(`/api/v3/flows/executor/${flowSlug}/`, {
      params: { query: '' },
    });


    let challenge = start.data as ExecutorChallenge;

    if (challenge.component === 'ak-stage-identification') {
      const idRes = await client.post(`/api/v3/flows/executor/${flowSlug}/`, {
        component: 'ak-stage-identification',
        uid_field: email,
      });



      challenge = idRes.data as ExecutorChallenge;
    }


    if (challenge.component === 'ak-stage-password') {
      const pwRes = await client.post(`/api/v3/flows/executor/${flowSlug}/`, {
        component: 'ak-stage-password',
        password,
      });

      console.dir(pwRes.data, { depth: null });


      challenge = pwRes.data as ExecutorChallenge;
    }



    if (challenge.component !== 'xak-flow-redirect' && !challenge.to) {
      throw new BusinessException(
        'AUTHENTIK_INVALID_CREDENTIALS',
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.exchangeSessionForTokens(client);

  }

  // Server-to-server, same as login()/exchangeSessionForTokens() — no
  // browser redirect involved, so this.client() (localhost:9000) is the
  // right client, not the public AUTHENTIK_URL OidcStrategy needs.
  //
  // Authentik may or may not rotate the refresh token on each use
  // (depends on the provider's refresh_token grant config) — fall back to
  // the input token only if the response genuinely omits one.
  async refresh(refreshToken: string): Promise<TokenResponse> {
    const client = this.client();
    const clientId = this.configService.getOrThrow<string>('CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const tokenRes = await client.post<TokenResponse>(
      '/application/o/token/',
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    // Authentik responds 400 invalid_grant for an expired/revoked/unknown
    // refresh token — a real, expected client condition (session expiry),
    // not an infra failure. Distinguished from AUTHENTIK_ERROR below the
    // same way login() distinguishes AUTHENTIK_INVALID_CREDENTIALS from a
    // generic Authentik failure — so the frontend can tell "log in again"
    // apart from "something's actually broken."
    if (tokenRes.status === 400) {
      throw new BusinessException(
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (tokenRes.status !== 200) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        `Failed to refresh token: ${JSON.stringify(tokenRes.data)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      ...tokenRes.data,
      refresh_token: tokenRes.data.refresh_token ?? refreshToken,
    };
  }

  async userInfo(accessToken: string) : Promise<OidcProfile> {
    const client = this.client();
    const response = await client.get<OidcProfile>(
      "/application/o/userinfo/",
      {
        headers : {
          Authorization : `Bearer ${accessToken}`
        }
      }
    )

    if (response.status !== 200) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        'Failed to fetch user information',
        HttpStatus.BAD_GATEWAY,
      );
    }


    return response.data;
  }

  private async exchangeSessionForTokens(client: AxiosInstance) : Promise<TokenResponse> {
    const clientId = this.configService.getOrThrow<string>('CLIENT_ID');
    const redirectUri = this.configService.getOrThrow<string>('CALLBACK');
    const clientSecret = this.configService.getOrThrow<string>('CLIENT_SECRET');

    const state = Math.random().toString(36).slice(2);

    const authRes = await client.get('/application/o/authorize/', {
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email offline_access',
        state,
      },
      maxRedirects: 0,
    });

    const location = authRes.headers['location'] as string | undefined;
    if (!location) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        'Authorization step did not return a redirect',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const code = new URL(
      location,
      this.configService.getOrThrow('AUTHENTIK_URL'),
    ).searchParams.get('code');
    if (!code) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        'No authorization code returned',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await client.post<TokenResponse>(
      '/application/o/token/',
      body,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );


    return tokenRes.data;
  }
}