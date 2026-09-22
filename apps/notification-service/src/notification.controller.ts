import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { RABBITMQ_EVENTS, PaymentSucceededEvent, OrderCreatedEvent } from '@tkt/common';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED)
  handlePaymentSucceeded(@Payload() event: PaymentSucceededEvent) {
    this.notificationService.sendTicketReceipt(event);
  }

  @EventPattern(RABBITMQ_EVENTS.ORDER_CREATED)
  handleOrderCreated(@Payload() event: OrderCreatedEvent) {
    this.notificationService.sendOrderCreatedAlert(event);
  }

  @EventPattern(RABBITMQ_EVENTS.ORDER_CANCELLED)
  handleOrderCancelled(@Payload() data: { orderId: string; reason: string }) {
    this.notificationService.sendCancellationAlert(data);
  }
}
