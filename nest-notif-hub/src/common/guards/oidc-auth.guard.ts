import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OidcAuthGuard extends AuthGuard('oidc') {
  handleRequest(err: any, user : any , info: any, context: ExecutionContext) {
    if(err || !user) {
      console.error('OIDC auth failed: ', {err, info});
    }
    return super.handleRequest(err, user, info, context);
  }
}