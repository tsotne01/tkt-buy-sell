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
  async createOrder(data: any) {
    const userId = data.userId || data.user_id;
    const ticketId = data.ticketId || data.ticket_id;
    const eventId = data.eventId || data.event_id;
    const amount = Number(data.amount) || 0;
    return this.orderService.createOrder({ user_id: userId, ticket_id: ticketId, event_id: eventId, amount });
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'GetOrderById')
  getOrderById(data: any) {
    const orderId = data.orderId || data.order_id;
    return this.orderService.getOrderById(orderId);
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'GetUserOrders')
  getUserOrders(data: any) {
    const userId = data.userId || data.user_id;
    return this.orderService.getUserOrders(userId);
  }

  @GrpcMethod(GRPC_SERVICES.ORDER_SERVICE, 'CancelOrder')
  cancelOrder(data: any) {
    const orderId = data.orderId || data.order_id;
    const reason = data.reason || 'User cancelled';
    return this.orderService.cancelOrder(orderId, reason);
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
