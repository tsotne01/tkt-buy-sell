import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OrderModule } from './order.module';
import { PROTO_PATHS, PROTO_PACKAGES } from '@tkt/proto';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);

  // 1. gRPC Server
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: PROTO_PACKAGES.ORDER,
      protoPath: PROTO_PATHS.ORDER,
      url: process.env.GRPC_URL || '0.0.0.0:50054',
    },
  });

  // 2. RabbitMQ Consumer for Saga feedback
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'order_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  console.log(`[OrderService] gRPC microservice running on ${process.env.GRPC_URL || '0.0.0.0:50054'}`);
  console.log(`[OrderService] RabbitMQ consumer connected to ${rabbitmqUrl}`);
}

bootstrap();
