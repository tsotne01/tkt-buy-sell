import { Controller, Get, Post, Param, Body, Inject, OnModuleInit, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';
import { EventsGateway } from '../gateways/events.gateway';

interface IOrderService {
  createOrder(data: any): Observable<any>;
  getOrderById(data: any): Observable<any>;
  getUserOrders(data: any): Observable<any>;
  cancelOrder(data: any): Observable<any>;
}

@Controller('orders')
export class OrderHttpController implements OnModuleInit {
  private readonly logger = new Logger(OrderHttpController.name);
  private orderService!: IOrderService;

  constructor(
    @Inject('ORDER_PACKAGE') private readonly client: ClientGrpc,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.orderService = this.client.getService<IOrderService>(GRPC_SERVICES.ORDER_SERVICE);
  }

  @Post()
  async createOrder(
    @Body() body: { user_id?: string; userId?: string; ticket_id?: string; ticketId?: string; event_id?: string; eventId?: string; amount?: number }
  ) {
    const payload = {
      user_id: body.user_id || body.userId,
      userId: body.user_id || body.userId,
      ticket_id: body.ticket_id || body.ticketId,
      ticketId: body.ticket_id || body.ticketId,
      event_id: body.event_id || body.eventId,
      eventId: body.event_id || body.eventId,
      amount: Number(body.amount) || 0,
    };
    const res = await firstValueFrom(this.orderService.createOrder(payload));
    if (res.error_message) {
      throw new HttpException(res.error_message, HttpStatus.BAD_REQUEST);
    }

    // Proactively monitor Saga completion in background and push real-time WebSocket events
    this.monitorOrderSaga(res.id, payload.ticket_id, payload.event_id, payload.user_id);

    return res;
  }

  private monitorOrderSaga(orderId: string, ticketId?: string, eventId?: string, userId?: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const order = await firstValueFrom(this.orderService.getOrderById({ order_id: orderId, orderId }));
        if (order && (order.status === 'COMPLETED' || order.status === 'CANCELLED')) {
          clearInterval(interval);
          if (order.status === 'COMPLETED') {
            this.logger.log(`[OrderSaga Monitor] Order ${orderId} COMPLETED in PostgreSQL! Broadcasting SOLD via WebSockets.`);
            this.eventsGateway.broadcastSeatUpdate(eventId || order.event_id, {
              ticket_id: ticketId || order.ticket_id,
              ticketId: ticketId || order.ticket_id,
              status: 'SOLD',
            });
            this.eventsGateway.broadcastOrderUpdate(userId || order.user_id, {
              orderId: order.id,
              id: order.id,
              ticketId: order.ticket_id,
              eventId: order.event_id,
              status: 'COMPLETED',
              amount: Number(order.amount) || 0,
              qr_code: order.qr_code || `TKT-${order.ticket_id}-${order.id}-PASS`,
              timestamp: new Date().toISOString(),
            });
          } else if (order.status === 'CANCELLED') {
            this.logger.warn(`[OrderSaga Monitor] Order ${orderId} CANCELLED. Broadcasting AVAILABLE via WebSockets.`);
            this.eventsGateway.broadcastSeatUpdate(eventId || order.event_id, {
              ticket_id: ticketId || order.ticket_id,
              ticketId: ticketId || order.ticket_id,
              status: 'AVAILABLE',
            });
            this.eventsGateway.broadcastOrderUpdate(userId || order.user_id, {
              orderId: order.id,
              id: order.id,
              ticketId: order.ticket_id,
              status: 'CANCELLED',
              reason: order.error_message || 'Payment declined',
            });
          }
        }
      } catch (err: any) {
        this.logger.debug(`[OrderSaga Monitor] Check attempt ${attempts}: ${err.message}`);
      }

      if (attempts >= 25) {
        clearInterval(interval);
      }
    }, 350);
  }

  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    return firstValueFrom(this.orderService.getOrderById({ order_id: orderId, orderId }));
  }

  @Get('user/:userId')
  async getUserOrders(@Param('userId') userId: string) {
    return firstValueFrom(this.orderService.getUserOrders({ user_id: userId, userId }));
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') orderId: string, @Body() body: { reason?: string }) {
    return firstValueFrom(this.orderService.cancelOrder({ order_id: orderId, orderId, reason: body.reason || 'User cancelled' }));
  }
}
