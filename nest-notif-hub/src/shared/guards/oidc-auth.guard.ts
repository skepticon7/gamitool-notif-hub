import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OidcAuthGuard extends AuthGuard('oidc') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (err || !user) {
      console.error('OIDC auth failed:', {
        err: err?.message ?? err,
        // `info` is where passport-openidconnect reports the real reason,
        // e.g. "Unable to verify authorization request state." (lost session)
        // or "ID token not issued by expected OpenID provider." (bad issuer).
        info: info?.message ?? info,
      });
    }
    return super.handleRequest(err, user, info, context, status);
  }
}