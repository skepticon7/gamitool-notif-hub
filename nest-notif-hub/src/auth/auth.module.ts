import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthentikModule } from '../infrastructure/authentik/authentik.module';
import { OidcStrategy } from './oidc/oidc.strategy';
import { PassportModule } from '@nestjs/passport';
import {JwtModule} from "@nestjs/jwt"
import { AuthentikService } from '../infrastructure/authentik/authentik.service';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersModule } from '../users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  controllers: [AuthController],
  providers: [AuthService , AuthentikService ,  OidcStrategy],
  imports: [ UsersModule ,CqrsModule ,AuthentikModule , PassportModule.register({session : true})  ,
    JwtModule.registerAsync({
      imports : [ConfigModule],
      inject : [ConfigService],
      useFactory : (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions : {
          expiresIn : '1h'
        }
      })
  })],
})
export class AuthModule {}
