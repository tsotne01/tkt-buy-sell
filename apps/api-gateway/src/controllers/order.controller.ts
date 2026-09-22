import { Controller, Get, Post, Param, Body, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';

interface IOrderService {
  createOrder(data: any): Observable<any>;
  getOrderById(data: any): Observable<any>;
  getUserOrders(data: any): Observable<any>;
  cancelOrder(data: any): Observable<any>;
}

@Controller('orders')
export class OrderHttpController implements OnModuleInit {
  private orderService!: IOrderService;

  constructor(@Inject('ORDER_PACKAGE') private readonly client: ClientGrpc) {}

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
    return res;
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
