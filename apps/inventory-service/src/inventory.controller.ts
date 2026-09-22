import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, EventPattern, Payload } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { GRPC_SERVICES } from '@tkt/proto';
import { RABBITMQ_EVENTS, PaymentSucceededEvent, PaymentFailedEvent } from '@tkt/common';

@Controller()
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  // ================= gRPC Handlers =================

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'GetTicketsForEvent')
  getTicketsForEvent(data: { event_id: string }) {
    return this.inventoryService.getTicketsForEvent(data.event_id);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ReserveTicketHold')
  reserveTicketHold(data: { ticket_id: string; user_id: string; hold_duration_seconds?: number }) {
    return this.inventoryService.reserveTicketHold(
      data.ticket_id,
      data.user_id,
      data.hold_duration_seconds || 600
    );
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ReleaseTicketHold')
  releaseTicketHold(data: { ticket_id: string; user_id: string }) {
    return this.inventoryService.releaseTicketHold(data.ticket_id, data.user_id);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ConfirmTicketSold')
  confirmTicketSold(data: { ticket_id: string; user_id: string; order_id: string }) {
    return this.inventoryService.confirmTicketSold(data.ticket_id, data.user_id, data.order_id);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ListResaleTicket')
  listResaleTicket(data: { ticket_id: string; seller_id: string; resale_price: number }) {
    return this.inventoryService.listResaleTicket(data.ticket_id, data.seller_id, data.resale_price);
  }

  // ================= RabbitMQ Saga Event Handlers =================

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED)
  handlePaymentSucceeded(@Payload() event: PaymentSucceededEvent) {
    this.logger.log(`[RabbitMQ Saga] Payment succeeded for order ${event.orderId}. Finalizing ticket ${event.ticketId}.`);
    this.inventoryService.confirmTicketSold(event.ticketId, event.userId, event.orderId);
  }

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_FAILED)
  handlePaymentFailed(@Payload() event: PaymentFailedEvent) {
    this.logger.warn(`[RabbitMQ Saga] Payment failed for order ${event.orderId}. Releasing hold on ticket ${event.ticketId}.`);
    this.inventoryService.releaseTicketHold(event.ticketId, event.userId);
  }

  @EventPattern(RABBITMQ_EVENTS.ORDER_CANCELLED)
  handleOrderCancelled(@Payload() data: { orderId: string; ticketId: string; userId: string }) {
    this.logger.warn(`[RabbitMQ Saga] Order ${data.orderId} cancelled. Releasing ticket hold.`);
    this.inventoryService.releaseTicketHold(data.ticketId, data.userId);
  }
}
