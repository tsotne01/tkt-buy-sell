import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RABBITMQ_EVENTS, PaymentSucceededEvent, PaymentFailedEvent } from '@tkt/common';
import { EventsGateway } from '../gateways/events.gateway';

@Controller()
export class GatewayEventsController {
  private readonly logger = new Logger(GatewayEventsController.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED)
  async handlePaymentSucceeded(@Payload() event: PaymentSucceededEvent) {
    this.logger.log(`[RabbitMQ -> Gateway WebSocket] Payment succeeded for order ${event.orderId}. Broadcasting SOLD status and user pass.`);
    
    // Broadcast seat SOLD update to all clients
    this.eventsGateway.broadcastSeatUpdate('', {
      ticket_id: event.ticketId,
      ticketId: event.ticketId,
      status: 'SOLD',
    });

    // Broadcast order completion with QR pass directly to the buying user
    this.eventsGateway.broadcastOrderUpdate(event.userId, {
      orderId: event.orderId,
      ticketId: event.ticketId,
      status: 'COMPLETED',
      amount: event.amount,
      qr_code: `TKT-${event.ticketId}-${event.orderId}-PASS`,
      timestamp: event.timestamp,
    });
  }

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: PaymentFailedEvent) {
    this.logger.warn(`[RabbitMQ -> Gateway WebSocket] Payment failed for order ${event.orderId}. Broadcasting seat back to AVAILABLE.`);
    
    // Release seat back to AVAILABLE for all clients
    this.eventsGateway.broadcastSeatUpdate('', {
      ticket_id: event.ticketId,
      ticketId: event.ticketId,
      status: 'AVAILABLE',
    });

    // Notify user of order cancellation
    this.eventsGateway.broadcastOrderUpdate(event.userId, {
      orderId: event.orderId,
      ticketId: event.ticketId,
      status: 'CANCELLED',
      reason: event.reason,
      timestamp: event.timestamp,
    });
  }

  @EventPattern(RABBITMQ_EVENTS.ORDER_CANCELLED)
  async handleOrderCancelled(@Payload() data: { orderId: string; ticketId: string; userId: string; reason?: string }) {
    this.logger.warn(`[RabbitMQ -> Gateway WebSocket] Order ${data.orderId} cancelled. Broadcasting seat AVAILABLE.`);
    
    this.eventsGateway.broadcastSeatUpdate('', {
      ticket_id: data.ticketId,
      ticketId: data.ticketId,
      status: 'AVAILABLE',
    });

    this.eventsGateway.broadcastOrderUpdate(data.userId, {
      orderId: data.orderId,
      ticketId: data.ticketId,
      status: 'CANCELLED',
      reason: data.reason || 'Order cancelled',
    });
  }
}
