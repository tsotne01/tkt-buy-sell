import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS, PROTO_PACKAGES, PROTO_LOADER_OPTIONS } from '@tkt/proto';
import { AuthHttpController } from './controllers/auth.controller';
import { CatalogHttpController } from './controllers/catalog.controller';
import { InventoryHttpController } from './controllers/inventory.controller';
import { OrderHttpController } from './controllers/order.controller';
import { HealthController } from './controllers/health.controller';
import { GatewayEventsController } from './controllers/gateway-events.controller';
import { EventsGateway } from './gateways/events.gateway';

const authGrpcUrl = process.env.AUTH_GRPC_URL || 'localhost:50051';
const catalogGrpcUrl = process.env.CATALOG_GRPC_URL || 'localhost:50052';
const inventoryGrpcUrl = process.env.INVENTORY_GRPC_URL || 'localhost:50053';
const orderGrpcUrl = process.env.ORDER_GRPC_URL || 'localhost:50054';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PROTO_PACKAGES.AUTH,
          protoPath: PROTO_PATHS.AUTH,
          url: authGrpcUrl,
          loader: PROTO_LOADER_OPTIONS,
        },
      },
      {
        name: 'CATALOG_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PROTO_PACKAGES.CATALOG,
          protoPath: PROTO_PATHS.CATALOG,
          url: catalogGrpcUrl,
          loader: PROTO_LOADER_OPTIONS,
        },
      },
      {
        name: 'INVENTORY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PROTO_PACKAGES.INVENTORY,
          protoPath: PROTO_PATHS.INVENTORY,
          url: inventoryGrpcUrl,
          loader: PROTO_LOADER_OPTIONS,
        },
      },
      {
        name: 'ORDER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PROTO_PACKAGES.ORDER,
          protoPath: PROTO_PATHS.ORDER,
          url: orderGrpcUrl,
          loader: PROTO_LOADER_OPTIONS,
        },
      },
    ]),
  ],
  controllers: [
    AuthHttpController,
    CatalogHttpController,
    InventoryHttpController,
    OrderHttpController,
    HealthController,
    GatewayEventsController,
  ],
  providers: [EventsGateway],
})
export class AppModule {}
