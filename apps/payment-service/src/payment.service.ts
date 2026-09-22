import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RABBITMQ_EVENTS, OrderCreatedEvent, PaymentSucceededEvent, PaymentFailedEvent } from '@tkt/common';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject('ORDER_RMQ_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('INVENTORY_RMQ_SERVICE') private readonly inventoryClient: ClientProxy
  ) {}

  async processOrderPayment(event: OrderCreatedEvent) {
    this.logger.log(`Processing payment for Order ${event.orderId}, Ticket ${event.ticketId}, Amount: $${event.amount}`);

    // Simulate 1.5s gateway latency (Stripe processing)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulated decline condition: amount === 999.99 triggers payment decline for testing Saga rollback
    if (event.amount === 999.99) {
      this.logger.warn(`Simulated card decline for order ${event.orderId}! Triggering Saga compensation...`);
      const failedPayload: PaymentFailedEvent = {
        orderId: event.orderId,
        ticketId: event.ticketId,
        userId: event.userId,
        reason: 'Insufficient funds / Card declined',
        timestamp: new Date().toISOString(),
      };

      this.orderClient.emit(RABBITMQ_EVENTS.PAYMENT_FAILED, failedPayload);
      this.inventoryClient.emit(RABBITMQ_EVENTS.PAYMENT_FAILED, failedPayload);
      return;
    }

    // Payment Succeeded
    const paymentId = `pay_${Date.now()}`;
    const successPayload: PaymentSucceededEvent = {
      orderId: event.orderId,
      ticketId: event.ticketId,
      userId: event.userId,
      paymentId,
      amount: event.amount,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Payment approved (${paymentId})! Broadcasting payment.succeeded to Order and Inventory services.`);
    this.orderClient.emit(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED, successPayload);
    this.inventoryClient.emit(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED, successPayload);
  }
}
