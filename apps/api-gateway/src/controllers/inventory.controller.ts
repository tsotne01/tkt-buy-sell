import { Controller, Get, Post, Param, Body, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';

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

  constructor(@Inject('INVENTORY_PACKAGE') private readonly client: ClientGrpc) {}

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
    @Body() body: { ticket_id?: string; ticketId?: string; user_id?: string; userId?: string; hold_duration_seconds?: number; holdDurationSeconds?: number }
  ) {
    const payload = {
      ticket_id: body.ticket_id || body.ticketId,
      ticketId: body.ticket_id || body.ticketId,
      user_id: body.user_id || body.userId,
      userId: body.user_id || body.userId,
      hold_duration_seconds: body.hold_duration_seconds || body.holdDurationSeconds || 600,
      holdDurationSeconds: body.hold_duration_seconds || body.holdDurationSeconds || 600,
    };
    const res = await firstValueFrom(this.inventoryService.reserveTicketHold(payload));
    if (!res.success) {
      throw new HttpException(res.error_message || 'Ticket hold failed', HttpStatus.CONFLICT);
    }
    return res;
  }

  @Post('release')
  async releaseTicketHold(@Body() body: { ticket_id?: string; ticketId?: string; user_id?: string; userId?: string }) {
    const payload = {
      ticket_id: body.ticket_id || body.ticketId,
      ticketId: body.ticket_id || body.ticketId,
      user_id: body.user_id || body.userId,
      userId: body.user_id || body.userId,
    };
    return firstValueFrom(this.inventoryService.releaseTicketHold(payload));
  }

  @Post('resale')
  async listResaleTicket(
    @Body() body: { ticket_id?: string; ticketId?: string; seller_id?: string; sellerId?: string; resale_price?: number; resalePrice?: number }
  ) {
    const payload = {
      ticket_id: body.ticket_id || body.ticketId,
      ticketId: body.ticket_id || body.ticketId,
      seller_id: body.seller_id || body.sellerId,
      sellerId: body.seller_id || body.sellerId,
      resale_price: body.resale_price ?? body.resalePrice ?? 0,
      resalePrice: body.resale_price ?? body.resalePrice ?? 0,
    };
    return firstValueFrom(this.inventoryService.listResaleTicket(payload));
  }
}
