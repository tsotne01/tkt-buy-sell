import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinEventRoom')
  handleJoinEventRoom(client: Socket, @MessageBody() eventId: string) {
    client.join(`event_${eventId}`);
    this.logger.log(`Socket ${client.id} joined room event_${eventId}`);
    return { status: 'joined', room: `event_${eventId}` };
  }

  broadcastSeatUpdate(eventId: string, ticketData: any) {
    this.server.to(`event_${eventId}`).emit('seatUpdated', ticketData);
  }

  broadcastOrderUpdate(userId: string, orderData: any) {
    this.server.emit(`user_order_${userId}`, orderData);
  }
}
