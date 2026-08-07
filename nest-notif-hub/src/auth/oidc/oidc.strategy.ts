import { Injectable } from '@nestjs/common';
import passport from 'passport';
import {
  Strategy,
  StrategyOptions,
  Profile,
  VerifyCallback,
} from 'passport-openidconnect';
import { OidcProfile } from '../types/auth.interfaces';

@Injectable()
export class OidcStrategy {
  constructor() {
    console.log('==============================');
    console.log('Loading OIDC Strategy...');
    console.log('==============================');

    const options: StrategyOptions = {
      issuer:
        process.env.AUTHENTIK_URL +
        '/application/o/' +
        process.env.AUTHENTIK_APP_SLUG +
        '/',
      authorizationURL: process.env.AUTHENTIK_URL + '/application/o/authorize/',
      tokenURL: process.env.AUTHENTIK_URL + '/application/o/token/',
      userInfoURL: process.env.AUTHENTIK_URL + '/application/o/userinfo/',
      clientID: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      callbackURL: process.env.AUTHENTIK_CALLBACK!,
      scope: ['openid', 'profile', 'email', 'offline_access'],
    };

    console.log('OIDC Configuration');
    console.log(options);

    passport.use(
      'oidc',
      new Strategy(
        options,
        (
          issuer: string,
          profile: Profile,
          context: unknown,
          idToken: string,
          accessToken: string,
          refreshToken: string,
          params: unknown,
          done: VerifyCallback,
        ) => {
          console.log('===================================');
          console.log('VERIFY CALLBACK WAS CALLED');
          console.log('===================================');

          console.log('Issuer:', issuer);

          console.log('Profile:');
          console.dir(profile, { depth: null });

          console.log('ID Token:');
          console.log(idToken);

          console.log('Access Token:');
          console.log(accessToken);

          console.log('Refresh Token:');
          console.log(refreshToken);

          console.log('Params:');
          console.dir(params, { depth: null });

          // The parsed `profile` only carries `.id`, `.displayName`, `.emails[]`.
          // The full OIDC claims (sub, email, name, groups) live on `._json`
          // (the raw userinfo response). Normalize into our OidcProfile shape.
          const claims = ((profile as { _json?: Record<string, unknown> })
            ._json ?? {}) as Record<string, unknown>;

          const user: OidcProfile = {
            id: profile.id,
            sub: (claims.sub as string) ?? profile.id,
            name:
              (claims.name as string) ?? (profile.displayName as string) ?? '',
            displayName:
              (profile.displayName as string) ?? (claims.name as string) ?? '',
            email:
              (claims.email as string) ??
              profile.emails?.[0]?.value ??
              '',
            groups: (claims.groups as string[]) ?? [],
            accessToken,
            refreshToken,
            idToken,
          };

          return done(null, user);
        },
      ),
    );

    console.log('OIDC Strategy registered.');
  }
}
