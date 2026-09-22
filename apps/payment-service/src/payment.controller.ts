import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { RABBITMQ_EVENTS, OrderCreatedEvent } from '@tkt/common';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern(RABBITMQ_EVENTS.ORDER_CREATED)
  async handleOrderCreated(@Payload() data: OrderCreatedEvent) {
    await this.paymentService.processOrderPayment(data);
  }
}
