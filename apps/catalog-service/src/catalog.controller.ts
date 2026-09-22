import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CatalogService } from './catalog.service';
import { GRPC_SERVICES } from '@tkt/proto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @GrpcMethod(GRPC_SERVICES.CATALOG_SERVICE, 'GetEvents')
  getEvents(query: { search?: string; category?: string; page?: number; limit?: number }) {
    return this.catalogService.getEvents(query);
  }

  @GrpcMethod(GRPC_SERVICES.CATALOG_SERVICE, 'GetEventById')
  getEventById(data: { id: string }) {
    return this.catalogService.getEventById(data.id);
  }

  @GrpcMethod(GRPC_SERVICES.CATALOG_SERVICE, 'CreateEvent')
  createEvent(data: any) {
    return this.catalogService.createEvent(data);
  }

  @GrpcMethod(GRPC_SERVICES.CATALOG_SERVICE, 'GetVenues')
  getVenues() {
    return this.catalogService.getVenues();
  }
}
