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
  async getTicketsForEvent(data: any) {
    const eventId = data.eventId || data.event_id;
    this.logger.log(`[gRPC] GetTicketsForEvent received for event: ${eventId}`);
    const result = await this.inventoryService.getTicketsForEvent(eventId);
    this.logger.log(`[gRPC] Found ${result.tickets.length} tickets`);
    return result;
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ReserveTicketHold')
  async reserveTicketHold(data: any) {
    const ticketId = data.ticketId || data.ticket_id;
    const userId = data.userId || data.user_id;
    const duration = data.holdDurationSeconds || data.hold_duration_seconds || 600;
    return this.inventoryService.reserveTicketHold(ticketId, userId, duration);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ReleaseTicketHold')
  async releaseTicketHold(data: any) {
    const ticketId = data.ticketId || data.ticket_id;
    const userId = data.userId || data.user_id;
    return this.inventoryService.releaseTicketHold(ticketId, userId);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ConfirmTicketSold')
  async confirmTicketSold(data: any) {
    const ticketId = data.ticketId || data.ticket_id;
    const userId = data.userId || data.user_id;
    const orderId = data.orderId || data.order_id;
    return this.inventoryService.confirmTicketSold(ticketId, userId, orderId);
  }

  @GrpcMethod(GRPC_SERVICES.INVENTORY_SERVICE, 'ListResaleTicket')
  async listResaleTicket(data: any) {
    const ticketId = data.ticketId || data.ticket_id;
    const sellerId = data.sellerId || data.seller_id;
    const resalePrice = data.resalePrice || data.resale_price;
    return this.inventoryService.listResaleTicket(ticketId, sellerId, resalePrice);
  }

  // ================= RabbitMQ Saga Event Handlers =================

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_SUCCEEDED)
  async handlePaymentSucceeded(@Payload() event: PaymentSucceededEvent) {
    this.logger.log(`[RabbitMQ Saga] Payment succeeded for order ${event.orderId}. Finalizing ticket ${event.ticketId}.`);
    await this.inventoryService.confirmTicketSold(event.ticketId, event.userId, event.orderId);
  }

  @EventPattern(RABBITMQ_EVENTS.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: PaymentFailedEvent) {
    this.logger.warn(`[RabbitMQ Saga] Payment failed for order ${event.orderId}. Releasing hold on ticket ${event.ticketId}.`);
    await this.inventoryService.releaseTicketHold(event.ticketId, event.userId);
  }

  @EventPattern(RABBITMQ_EVENTS.ORDER_CANCELLED)
  async handleOrderCancelled(@Payload() data: { orderId: string; ticketId: string; userId: string }) {
    this.logger.warn(`[RabbitMQ Saga] Order ${data.orderId} cancelled. Releasing ticket hold.`);
    await this.inventoryService.releaseTicketHold(data.ticketId, data.userId);
  }
}
