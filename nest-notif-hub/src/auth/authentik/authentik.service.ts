import { HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ExecutorChallenge, TokenResponse } from './types/authentik.interfaces';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

@Injectable()
export class AuthentikService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private client(): AxiosInstance {
    const jar = new CookieJar();
    const instance = wrapper(
      axios.create({
        baseURL: this.configService.getOrThrow<string>('AUTHENTIK_URL'),
        jar,
        withCredentials: true,
        validateStatus: () => true,
      } as any),
    );
    return instance;
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const client = this.client();
    const flowSlug = this.configService.getOrThrow<string>(
      'AUTHENTIK_LOGIN_FLOW_SLUG',
    );

    const start = await client.get(`/api/v3/flows/executor/${flowSlug}/`, {
      params: { query: '' },
    });

    console.log(start.request?.res?.responseUrl);

    let challenge = start.data as ExecutorChallenge;

    if (challenge.component === 'ak-stage-identification') {
      const idRes = await client.post(`/api/v3/flows/executor/${flowSlug}/`, {
        component: 'ak-stage-identification',
        uid_field: email,
      });



      challenge = idRes.data as ExecutorChallenge;
    }


    if (challenge.component === 'ak-stage-password') {
      const pwRes = await client.post(`/api/v3/flows/executor/${flowSlug}/`, {
        component: 'ak-stage-password',
        password,
      });

      console.dir(pwRes.data, { depth: null });


      challenge = pwRes.data as ExecutorChallenge;
    }



    if (challenge.component !== 'xak-flow-redirect' && !challenge.to) {
      throw new BusinessException(
        'AUTHENTIK_INVALID_CREDENTIALS',
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.exchangeSessionForTokens(client);

  }

  // async login(username: string, password: string): Promise<TokenResponse> {
  //   const authentikUrl = this.configService.getOrThrow<string>('AUTHENTIK_URL');
  //   const clientId = this.configService.getOrThrow<string>('CLIENT_ID');
  //   const clientSecret = this.configService.getOrThrow<string>('CLIENT_SECRET');
  //
  //   const body = new URLSearchParams({
  //     grant_type: 'password',
  //     client_id: clientId,
  //     client_secret: clientSecret,
  //     username,
  //     password,
  //   });
  //
  //   try {
  //     const { data } = await firstValueFrom(
  //       this.httpService.post<TokenResponse>(
  //         `${authentikUrl}/application/o/token`,
  //         body,
  //         { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  //       ),
  //     );
  //     return data;
  //   } catch (error) {
  //     if (error instanceof AxiosError) {
  //       console.log('Status:', error.response?.status);
  //       console.log('Data:', error.response?.data);
  //     }
  //     return this.handleError(error);
  //   }
  // }
  //
  // private handleError(error: unknown): never {
  //   if (error instanceof AxiosError) {
  //     const status = error.response?.status;
  //     if (status === 400 || status === 401) {
  //       throw new BusinessException(
  //         'AUTHENTIK_INVALID_CREDENTIALS',
  //         'Invalid username or password',
  //         HttpStatus.UNAUTHORIZED,
  //       );
  //     }
  //
  //     if (!error.response) {
  //       throw new BusinessException(
  //         'AUTHENTIK_UNREACHABLE',
  //         'Identity provider is unreachable',
  //         HttpStatus.BAD_GATEWAY,
  //       );
  //     }
  //
  //     throw new BusinessException(
  //       'AUTHENTIK_ERROR',
  //       'Identity provider returned an unexpected error',
  //       HttpStatus.BAD_GATEWAY,
  //     );
  //   }
  //
  //   throw new BusinessException(
  //     'AUTHENTIK_UNKNOWN_ERROR',
  //     'Unexpected error while contacing identity provider',
  //     HttpStatus.INTERNAL_SERVER_ERROR,
  //   );
  // }
  private async exchangeSessionForTokens(client: AxiosInstance) : Promise<TokenResponse> {
    const clientId = this.configService.getOrThrow<string>('CLIENT_ID');
    const redirectUri = this.configService.getOrThrow<string>('CALLBACK');
    const clientSecret = this.configService.getOrThrow<string>('CLIENT_SECRET');

    const state = Math.random().toString(36).slice(2);

    const authRes = await client.get('/application/o/authorize/', {
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state,
      },
      maxRedirects: 0, // we want the Location header, not to follow it
    });

    const location = authRes.headers['location'] as string | undefined;
    if (!location) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        'Authorization step did not return a redirect',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const code = new URL(
      location,
      this.configService.getOrThrow('AUTHENTIK_URL'),
    ).searchParams.get('code');
    if (!code) {
      throw new BusinessException(
        'AUTHENTIK_ERROR',
        'No authorization code returned',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await client.post<TokenResponse>(
      '/application/o/token/',
      body,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return tokenRes.data;
  }
}