import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthentikModule } from './authentik/authentik.module';
import { OidcStrategy } from './oidc/oidc.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  controllers: [AuthController],
  providers: [AuthService , OidcStrategy],
  imports: [AuthentikModule , PassportModule.register({session : true})],
})
export class AuthModule {}
