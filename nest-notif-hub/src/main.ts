import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import session from 'express-session';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Without this, NotificationGateway's engine.io instance doesn't attach to
  // the app's own HTTP server — it silently spins up a standalone server on
  // a random OS-assigned port instead, and app.listen(PORT) below never
  // actually binds the port everyone expects it to.
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3100'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders : '*',
  })
  app.useWebSocketAdapter(new IoAdapter(app));
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

  // /api serves interactive Swagger UI, /api-json serves the raw OpenAPI
  // document — built from each controller/DTO's existing decorators
  // (@Controller, @Get/@Post/etc., class-validator DTOs), no route needs
  // rewriting for this to work. Paste a JWT from POST /auth/login into the
  // "Authorize" button (bearer scheme below) to call guarded routes from
  // the UI directly.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EDEN API')
    .setDescription(
      'Event-driven notification & gamification engine — missions, XP/levels, badges, and the admin-configurable rule graph wiring them together.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  await app.listen(
    process.env.PORT ?? 3001
  );
}
bootstrap();
