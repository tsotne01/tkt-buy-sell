import { Controller, Get, Post, Param, Query, Body, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';

interface ICatalogService {
  getEvents(data: any): Observable<any>;
  getEventById(data: any): Observable<any>;
  createEvent(data: any): Observable<any>;
  getVenues(data: any): Observable<any>;
}

@Controller('events')
export class CatalogHttpController implements OnModuleInit {
  private catalogService!: ICatalogService;

  constructor(@Inject('CATALOG_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.catalogService = this.client.getService<ICatalogService>(GRPC_SERVICES.CATALOG_SERVICE);
  }

  @Get()
  async getEvents(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return firstValueFrom(
      this.catalogService.getEvents({
        search: search || '',
        category: category || '',
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      })
    );
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return firstValueFrom(this.catalogService.getEventById({ id }));
  }

  @Post()
  async createEvent(@Body() body: any) {
    return firstValueFrom(this.catalogService.createEvent(body));
  }
}
