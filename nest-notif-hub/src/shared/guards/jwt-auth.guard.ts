import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (err || !user) {
      console.error('JWT auth failed:', {
        err: err?.message ?? err,
        info: info?.message ?? info,
      });
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
