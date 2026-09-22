import { Injectable, Logger } from '@nestjs/common';
import { PaymentSucceededEvent, OrderCreatedEvent } from '@tkt/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  sendTicketReceipt(event: PaymentSucceededEvent) {
    this.logger.log(`================ NOTIFICATION DISPATCHED ================`);
    this.logger.log(`TO: User ${event.userId}`);
    this.logger.log(`SUBJECT: Your Tickets for Order ${event.orderId} are Confirmed!`);
    this.logger.log(`TICKET ID: ${event.ticketId}`);
    this.logger.log(`TOTAL CHARGED: $${event.amount}`);
    this.logger.log(`ATTACHMENT: ticket-pass-${event.ticketId}.pdf [GENERATED]`);
    this.logger.log(`=========================================================`);
  }

  sendOrderCreatedAlert(event: OrderCreatedEvent) {
    this.logger.log(`[Notification] Order ${event.orderId} initiated for ticket ${event.ticketId}. Awaiting payment confirmation.`);
  }

  sendCancellationAlert(data: { orderId: string; reason: string }) {
    this.logger.warn(`[Notification] Order ${data.orderId} was cancelled (${data.reason}). Refund/Release notice sent.`);
  }
}
