import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AuthModule } from './auth.module';
import { PROTO_PATHS, PROTO_PACKAGES, PROTO_LOADER_OPTIONS } from '@tkt/proto';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AuthModule, {
    transport: Transport.GRPC,
    options: {
      package: PROTO_PACKAGES.AUTH,
      protoPath: PROTO_PATHS.AUTH,
      url: process.env.GRPC_URL || '0.0.0.0:50051',
      loader: PROTO_LOADER_OPTIONS,
    },
  });

  await app.listen();
  console.log(`[AuthService] gRPC microservice is running on ${process.env.GRPC_URL || '0.0.0.0:50051'}`);
}

bootstrap();
