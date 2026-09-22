import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { InventoryModule } from './inventory.module';
import { PROTO_PATHS, PROTO_PACKAGES, PROTO_LOADER_OPTIONS } from '@tkt/proto';

async function bootstrap() {
  const app = await NestFactory.create(InventoryModule);

  // 1. gRPC Server
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: PROTO_PACKAGES.INVENTORY,
      protoPath: PROTO_PATHS.INVENTORY,
      url: process.env.GRPC_URL || '0.0.0.0:50053',
      loader: PROTO_LOADER_OPTIONS,
    },
  });

  // 2. RabbitMQ Consumer for Saga feedback
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'inventory_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.init();
  console.log(`[InventoryService] gRPC microservice running on ${process.env.GRPC_URL || '0.0.0.0:50053'}`);
  console.log(`[InventoryService] RabbitMQ consumer connected to ${rabbitmqUrl}`);
}

bootstrap();
