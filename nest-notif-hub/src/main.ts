import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import session from 'express-session';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-secret-got-to-be-changed',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // requires HTTPS in prod
        httpOnly: true,
        sameSite: 'lax', // sent on the top-level redirect back from Authentik
        maxAge: 10 * 60 * 1000, // short-lived — only needed for the OIDC handshake
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(passport.initialize());
  app.use(passport.session());
  await app.listen(
    process.env.PORT ?? 3001
  );
}
bootstrap();
