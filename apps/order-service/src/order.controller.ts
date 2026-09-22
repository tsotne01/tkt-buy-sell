import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, EventPattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { GRPC_SERVICES } from '@tkt/proto';
import { RABBITMQ_EVENTS, PaymentSucceededEvent, PaymentFailedEvent } from '@tkt/common';

@Controller()
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  // ================= gRPC Handlers =================

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'CreateOrder')
  async createOrder(data: { user_id: string; ticket_id: string; event_id: string; amount: number }) {
    return this.orderService.createOrder(data);
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'GetOrderById')
  getOrderById(data: { order_id: string }) {
    return this.orderService.getOrderById(data.order_id);
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'GetUserOrders')
  getUserOrders(data: { user_id: string }) {
    return this.orderService.getUserOrders(data.user_id);
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'CancelOrder')
  cancelOrder(data: { order_id: string; reason: string }) {
    return this.orderService.cancelOrder(data.order_id, data.reason);
  }

  // ================= RabbitMQ Saga Handlers =================

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED)
  handlePaymentSucceeded(@Payload() event: PaymentSucceededEvent) {
    this.logger.log(`[RabbitMQ Saga] Payment succeeded received for order ${event.orderId}`);
    this.orderService.markOrderCompleted(event.orderId, event.ticketId);
  }

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_FAILED)
  handlePaymentFailed(@Payload() event: PaymentFailedEvent) {
    this.logger.warn(`[RabbitMQ Saga] Payment failed received for order ${event.orderId}: ${event.reason}`);
    this.orderService.markOrderFailed(event.orderId, event.reason);
  }
}
