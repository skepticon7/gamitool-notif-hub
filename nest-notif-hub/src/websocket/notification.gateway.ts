import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import * as jwt from 'jsonwebtoken'
import { ConfigService } from '@nestjs/config';


@WebSocketGateway({cors: {origin: true , credentials: true}})
export class NotificationGateway implements OnGatewayConnection {

  private readonly logger : Logger = new Logger(NotificationGateway.name);
  @WebSocketServer()
  server: Server;

  constructor(private readonly configService: ConfigService) {}

  handleConnection(client: Socket, ...args: any[]): any {
    try {
      // Real Socket.IO clients send the token via the handshake's `auth`
      // field. Some simpler test clients (e.g. Postman's Socket.IO request,
      // when it only exposes raw headers) can't set that — the handshake is
      // still a real HTTP request under the hood, so a plain Authorization
      // header works as a fallback there.
      const authHeader = client.handshake.headers?.authorization;
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const token = client.handshake.auth?.token ?? headerToken;
      const payload = jwt.verify(token, this.configService.getOrThrow<string>('JWT_SECRET')) as AppJwtPayload;
      this.logger.log('[WEBSOCKET] opening websocket connection with : ' + payload.userId);
      // Whichever admin(s) happen to be connected right now get engine
      // activity pushes — derived purely from their own JWT at connection
      // time, no DB lookup needed to figure out "which admin" downstream.
      if(payload.groups.includes('admin'))
        client.join('admins')
      else
        client.join(`user:${payload.userId}`)
    }catch (e) {
      this.logger.error(
        '[WEBSOCKET] error opening connection : ',
        e instanceof Error ? e.stack : String(e),
      );
      client.disconnect();
    }
  }

  emitToEmployee(employeeId: string , event: string, data: unknown) {
    this.server.to(`user:${employeeId}`).emit(event, data);
  }

  broadcastToAdmins(event: string, data: unknown) {
    this.server.to('admins').emit(event, data);
  }

}