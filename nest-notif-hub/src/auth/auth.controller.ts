import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import type {Request} from 'express'
import { OidcProfile } from './types/auth.interfaces';
import { OidcAuthGuard } from '../shared/guards/oidc-auth.guard';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() dto: LoginDto) {
      return this.authService.loginWithPassword(dto);
    }

    @Post('refresh')
    async refresh(@Body() dto: RefreshDto) {
      return this.authService.refresh(dto.refreshToken);
    }


    @Get('oidc/login')
    @UseGuards(OidcAuthGuard)
    oidcLogin() {

    }


    @Get('oidc/callback')
    @UseGuards(OidcAuthGuard)
    async oidcCallback(@Req() req: Request) {
      const profile = req.user as OidcProfile;
      return this.authService.loginWithOidc(profile);
    }

}
