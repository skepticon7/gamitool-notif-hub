import { Injectable } from '@nestjs/common';
import { AuthentikService } from '../infrastructure/authentik/authentik.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponse } from '../infrastructure/authentik/types/authentik.interfaces';
import {
  AppJwtPayload,
  LoginResult,
  OidcProfile,
} from './types/auth.interfaces';
import { CommandBus } from '@nestjs/cqrs';
import { MySqlUserRepository } from '../users/repositories/mysql-user-repository';
import { CreateUserCommand } from '../users/commands/create-user.command';
import { UserEntity } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

    constructor(
      private authentikService: AuthentikService,
      private readonly commandBus: CommandBus,
      private readonly mysqlRepo: MySqlUserRepository,
      private readonly jwtService : JwtService
    ) {}


    async loginWithPassword(dto: LoginDto) : Promise<LoginResult> {

      const token: TokenResponse = await this.authentikService.login(dto.email , dto.password);
      const profile = await this.authentikService.userInfo(token.access_token);
      const user = await this.jitProvision(profile);

      return {
        accessToken : await this.generateJwt(user! , profile.groups),
        refreshToken : token.refresh_token,
        tokenType: "Bearer",
      }

    }


    async loginWithOidc(profile : OidcProfile) : Promise<LoginResult> {
      const user = await this.jitProvision(profile);
      const jwt = await this.generateJwt(user! , profile.groups);

      return {
        accessToken: jwt ?? '',
        refreshToken : profile.refreshToken,
        tokenType : 'Bearer'
      }
    }


    private async jitProvision(profile: OidcProfile) : Promise<UserEntity | null> {
      console.log('profile : ' + JSON.stringify(profile));
      let user = await this.mysqlRepo.findBySub(profile.sub)
      if(!user) {
        user = await this.commandBus.execute(new CreateUserCommand(
          profile.sub,
          profile.email,
          profile.name
        ))
      }
      return user;
    }


    private async generateJwt(user: UserEntity , groups: string[]) : Promise<string> {
      console.log(process.env.JWT_SECRET);
      const payload : AppJwtPayload = {
        sub: user.sub,
        userId: user.id,
        email: user.email,
        name: user.name,
        groups,
      }
      return this.jwtService.signAsync(payload);
    }



}
