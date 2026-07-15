import { Injectable } from '@nestjs/common';
import passport from 'passport';
import {
  Strategy,
  StrategyOptions,
  Profile,
  VerifyCallback,
} from 'passport-openidconnect';

@Injectable()
export class OidcStrategy {
  constructor() {
    const options: StrategyOptions = {
      issuer:
        process.env.AUTHENTIK_URL +
        '/application/o/' +
        process.env.AUTHENTIK_APP_SLUG +
        '/',
      authorizationURL: process.env.AUTHENTIK_URL + '/application/o/authorize/',
      tokenURL: process.env.AUTHENTIK_URL + '/application/o/token/',
      userInfoURL: process.env.AUTHENTIK_URL + '/application/o/userinfo/',
      clientID: process.env.CLIENT_ID!,
      clientSecret: process.env.CLIENT_SECRET!,
      callbackURL: process.env.CALLBACK!,
      scope: ['openid', 'profile', 'email' , 'offline_access'],
    };

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
          done(null, {
            ...profile,
            accessToken,
            refreshToken,
            idToken,
          });
        },
      ),
    );
  }
}
