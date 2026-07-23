import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthentikService } from '../infrastructure/authentik/authentik.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponse } from '../infrastructure/authentik/types/authentik.interfaces';
import {
  AppJwtPayload,
  LoginResult,
  OidcProfile,
} from './types/auth.interfaces';
import { MySqlUserRepository } from '../users/repositories/mysql-user-repository';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { EmployeeUserEntity } from '../users/entities/employee-user.entity';
import { JwtService } from '@nestjs/jwt';
import { BusinessException } from '../shared/exceptions/business.exception';

@Injectable()
export class AuthService {

    constructor(
      private authentikService: AuthentikService,
      private readonly mysqlRepo: MySqlUserRepository,
      private readonly jwtService : JwtService
    ) {}


    async loginWithPassword(dto: LoginDto) : Promise<LoginResult> {

      const token: TokenResponse = await this.authentikService.login(dto.email , dto.password);
      const profile = await this.authentikService.userInfo(token.access_token);
      const user = await this.resolveUser(profile);


      return {
        accessToken : await this.generateJwt(user),
        refreshToken : token.refresh_token,
        tokenType: "Bearer",
      }

    }


    async loginWithOidc(profile : OidcProfile) : Promise<LoginResult> {
      const user = await this.resolveUser(profile);
      const jwt = await this.generateJwt(user);

      return {
        accessToken: jwt,
        refreshToken : profile.refreshToken,
        tokenType : 'Bearer'
      }
    }


    // Closed provisioning: an account must already exist (created via
    // CreateAccountHandler, or the one-time admin bootstrap seed) — never
    // auto-created here. Authentik proving identity is not the same as EDEN
    // granting access; only accounts EDEN itself created may log in.
    private async resolveUser(profile: OidcProfile) : Promise<UserEntity> {
      const user = await this.mysqlRepo.findBySub(profile.sub);
      if (!user) {
        throw new BusinessException(
          'ACCOUNT_NOT_PROVISIONED',
          'No account exists for this identity — ask an admin to create one',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return user;
    }


    // groups is sourced from EDEN's own STI hierarchy (which concrete class
    // TypeORM hydrated the row as), never from Authentik's OIDC groups claim.
    private roleOf(user: UserEntity): UserRole {
      return user instanceof EmployeeUserEntity ? 'employee' : 'admin';
    }

    private async generateJwt(user: UserEntity) : Promise<string> {
      const payload : AppJwtPayload = {
        sub: user.sub,
        userId: user.id,
        email: user.email,
        name: user.name,
        groups: [this.roleOf(user)],
      }
      return this.jwtService.signAsync(payload);
    }



}
