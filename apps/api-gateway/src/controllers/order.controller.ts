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
    @Body() body: { user_id: string; ticket_id: string; event_id: string; amount: number }
  ) {
    const res = await firstValueFrom(this.orderService.createOrder(body));
    if (res.error_message) {
      throw new HttpException(res.error_message, HttpStatus.BAD_REQUEST);
    }
    return res;
  }

  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    return firstValueFrom(this.orderService.getOrderById({ order_id: orderId }));
  }

  @Get('user/:userId')
  async getUserOrders(@Param('userId') userId: string) {
    return firstValueFrom(this.orderService.getUserOrders({ user_id: userId }));
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') orderId: string, @Body() body: { reason?: string }) {
    return firstValueFrom(this.orderService.cancelOrder({ order_id: orderId, reason: body.reason || 'User cancelled' }));
  }
}
