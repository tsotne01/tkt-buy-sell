import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
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
  handleJoinEventRoom(@ConnectedSocket() client: Socket, @MessageBody() eventId: string) {
    if (client && typeof client.join === 'function' && eventId) {
      client.join(`event_${eventId}`);
      this.logger.log(`Socket ${client.id} joined room event_${eventId}`);
      return { status: 'joined', room: `event_${eventId}` };
    }
    return { status: 'error', message: 'Unable to join room' };
  }

  @SubscribeMessage('leaveEventRoom')
  handleLeaveEventRoom(@ConnectedSocket() client: Socket, @MessageBody() eventId: string) {
    if (client && typeof client.leave === 'function' && eventId) {
      client.leave(`event_${eventId}`);
      this.logger.log(`Socket ${client.id} left room event_${eventId}`);
      return { status: 'left', room: `event_${eventId}` };
    }
    return { status: 'error', message: 'Unable to leave room' };
  }

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(@ConnectedSocket() client: Socket, @MessageBody() userId: string) {
    if (client && typeof client.join === 'function' && userId) {
      client.join(`user_${userId}`);
      this.logger.log(`Socket ${client.id} joined user room user_${userId}`);
      return { status: 'joined', room: `user_${userId}` };
    }
    return { status: 'error', message: 'Unable to join user room' };
  }

  broadcastSeatUpdate(eventId: string, ticketData: any) {
    if (!this.server) {
      this.logger.warn('Socket.IO server is not ready yet for broadcastSeatUpdate');
      return;
    }
    this.logger.log(`[WebSocket] Broadcasting seatUpdated: event=${eventId}, ticket=${ticketData.ticket_id || ticketData.ticketId}, status=${ticketData.status}`);
    const payload = { eventId, ...ticketData };
    if (eventId) {
      this.server.to(`event_${eventId}`).emit('seatUpdated', payload);
    }
    // Also emit globally so overview seat counts can update
    this.server.emit('seatUpdated', payload);
  }

  broadcastOrderUpdate(userId: string, orderData: any) {
    if (!this.server) {
      this.logger.warn('Socket.IO server is not ready yet for broadcastOrderUpdate');
      return;
    }
    this.logger.log(`[WebSocket] Broadcasting orderUpdated for user ${userId}: order=${orderData.orderId || orderData.id}`);
    const payload = { userId, ...orderData };
    if (userId) {
      this.server.to(`user_${userId}`).emit('orderUpdated', payload);
      this.server.emit(`user_order_${userId}`, payload);
    }
    this.server.emit('orderUpdated', payload);
  }
}
