import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { CatalogModule } from './catalog.module';
import { PROTO_PATHS, PROTO_PACKAGES } from '@tkt/proto';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(CatalogModule, {
    transport: Transport.GRPC,
    options: {
      package: PROTO_PACKAGES.CATALOG,
      protoPath: PROTO_PATHS.CATALOG,
      url: process.env.GRPC_URL || '0.0.0.0:50052',
    },
  });

  await app.listen();
  console.log(`[CatalogService] gRPC microservice is running on ${process.env.GRPC_URL || '0.0.0.0:50052'}`);
}

bootstrap();
