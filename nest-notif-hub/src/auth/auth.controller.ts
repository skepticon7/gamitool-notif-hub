import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import type {Request} from 'express'
import { OidcProfile } from './types/auth.interfaces';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() dto: LoginDto) {
      return this.authService.loginWithPassword(dto);
    }



    @Get('oidc/login')
    @UseGuards(AuthGuard('oidc'))
    oidcLogin() {

    }


    @Get('oidc/callback')
    @UseGuards(AuthGuard('oidc'))
    async oidcCallback(@Req() req: Request) {
      const profile = req.user as OidcProfile;
      return this.authService.loginWithOidc(profile);
    }

}
