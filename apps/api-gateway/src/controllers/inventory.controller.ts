import { Controller, Get, Post, Param, Body, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';
import { EventsGateway } from '../gateways/events.gateway';

interface IInventoryService {
  getTicketsForEvent(data: any): Observable<any>;
  reserveTicketHold(data: any): Observable<any>;
  releaseTicketHold(data: any): Observable<any>;
  confirmTicketSold(data: any): Observable<any>;
  listResaleTicket(data: any): Observable<any>;
}

@Controller('inventory')
export class InventoryHttpController implements OnModuleInit {
  private inventoryService!: IInventoryService;

  constructor(
    @Inject('INVENTORY_PACKAGE') private readonly client: ClientGrpc,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.inventoryService = this.client.getService<IInventoryService>(GRPC_SERVICES.INVENTORY_SERVICE);
  }

  @Get('events/:eventId/tickets')
  async getTicketsForEvent(@Param('eventId') eventId: string) {
    try {
      const res = await firstValueFrom(
        this.inventoryService.getTicketsForEvent({ event_id: eventId, eventId })
      );
      return res;
    } catch (err: any) {
      return { error: err.message || String(err), details: err };
    }
  }

  @Post('hold')
  async reserveTicketHold(
    @Body() body: { ticket_id?: string; ticketId?: string; user_id?: string; userId?: string; hold_duration_seconds?: number; holdDurationSeconds?: number; event_id?: string; eventId?: string }
  ) {
    const ticketId = body.ticket_id || body.ticketId;
    const userId = body.user_id || body.userId;
    const duration = body.hold_duration_seconds || body.holdDurationSeconds || 600;
    const eventId = body.event_id || body.eventId || '';

    const payload = {
      ticket_id: ticketId,
      ticketId,
      user_id: userId,
      userId,
      hold_duration_seconds: duration,
      holdDurationSeconds: duration,
    };
    const res = await firstValueFrom(this.inventoryService.reserveTicketHold(payload));
    if (!res.success) {
      throw new HttpException(res.error_message || 'Ticket hold failed', HttpStatus.CONFLICT);
    }

    // Real-Time WebSocket Broadcast
    this.eventsGateway.broadcastSeatUpdate(eventId, {
      ticket_id: ticketId,
      ticketId,
      status: 'HELD',
      held_by_user_id: userId,
      hold_expires_at: Date.now() + duration * 1000,
    });

    return res;
  }

  @Post('release')
  async releaseTicketHold(@Body() body: { ticket_id?: string; ticketId?: string; user_id?: string; userId?: string; event_id?: string; eventId?: string }) {
    const ticketId = body.ticket_id || body.ticketId;
    const userId = body.user_id || body.userId;
    const eventId = body.event_id || body.eventId || '';

    const payload = {
      ticket_id: ticketId,
      ticketId,
      user_id: userId,
      userId,
    };
    const res = await firstValueFrom(this.inventoryService.releaseTicketHold(payload));

    // Real-Time WebSocket Broadcast
    this.eventsGateway.broadcastSeatUpdate(eventId, {
      ticket_id: ticketId,
      ticketId,
      status: 'AVAILABLE',
      held_by_user_id: '',
      hold_expires_at: 0,
    });

    return res;
  }

  @Post('resale')
  async listResaleTicket(
    @Body() body: { ticket_id?: string; ticketId?: string; seller_id?: string; sellerId?: string; resale_price?: number; resalePrice?: number; event_id?: string; eventId?: string }
  ) {
    const ticketId = body.ticket_id || body.ticketId;
    const sellerId = body.seller_id || body.sellerId;
    const resalePrice = body.resale_price ?? body.resalePrice ?? 0;
    const eventId = body.event_id || body.eventId || '';

    const payload = {
      ticket_id: ticketId,
      ticketId,
      seller_id: sellerId,
      sellerId,
      resale_price: resalePrice,
      resalePrice,
    };
    const res = await firstValueFrom(this.inventoryService.listResaleTicket(payload));

    // Real-Time WebSocket Broadcast
    this.eventsGateway.broadcastSeatUpdate(eventId, {
      ticket_id: ticketId,
      ticketId,
      status: 'AVAILABLE',
      is_resale: true,
      seller_id: sellerId,
      price: resalePrice,
    });

    return res;
  }
}
