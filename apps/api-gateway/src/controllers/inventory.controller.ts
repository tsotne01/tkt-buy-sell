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
    return firstValueFrom(this.inventoryService.getTicketsForEvent({ event_id: eventId }));
  }

  @Post('hold')
  async reserveTicketHold(
    @Body() body: { ticket_id: string; user_id: string; hold_duration_seconds?: number }
  ) {
    const res = await firstValueFrom(this.inventoryService.reserveTicketHold(body));
    if (!res.success) {
      throw new HttpException(res.error_message || 'Ticket hold failed', HttpStatus.CONFLICT);
    }
    return res;
  }

  @Post('release')
  async releaseTicketHold(@Body() body: { ticket_id: string; user_id: string }) {
    return firstValueFrom(this.inventoryService.releaseTicketHold(body));
  }

  @Post('resale')
  async listResaleTicket(
    @Body() body: { ticket_id: string; seller_id: string; resale_price: number }
  ) {
    return firstValueFrom(this.inventoryService.listResaleTicket(body));
  }
}
