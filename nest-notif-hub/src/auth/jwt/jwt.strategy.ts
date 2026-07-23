import { Injectable } from '@nestjs/common';
import passport from 'passport';
import { Strategy, ExtractJwt, StrategyOptions, VerifiedCallback } from 'passport-jwt';
import { AppJwtPayload } from '../types/auth.interfaces';

// Same manual passport.use() pattern as OidcStrategy (src/auth/oidc/oidc.strategy.ts)
// rather than the @nestjs/passport PassportStrategy mixin, for consistency.
@Injectable()
export class JwtStrategy {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    };

    passport.use(
      'jwt',
      new Strategy(options, (payload: AppJwtPayload, done: VerifiedCallback) => {
        // Signature/expiry already verified by passport-jwt at this point —
        // the payload becomes req.user as-is.
        return done(null, payload);
      }),
    );
  }
}
