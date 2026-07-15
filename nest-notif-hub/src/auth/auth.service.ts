import { Injectable } from '@nestjs/common';
import { AuthentikService } from './authentik/authentik.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponse } from './authentik/types/authentik.interfaces';
import { LoginResult, OidcProfile } from './types/auth.interfaces';

@Injectable()
export class AuthService {

    constructor(private authentikService: AuthentikService) {}
    async loginWithPassword(dto: LoginDto) : Promise<LoginResult> {

      const token: TokenResponse = await this.authentikService.login(dto.email , dto.password);

      return {
        accessToken : token.access_token,
        refreshToken : token.refresh_token,
        tokenType: token.token_type,
      }

    }


    async loginWithOidc(profile : OidcProfile) : Promise<LoginResult> {
      return {
        accessToken: profile.accessToken ?? '',
        refreshToken : profile.refreshToken,
        tokenType : 'Bearer'
      }
    }


}
