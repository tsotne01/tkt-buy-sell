import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { PaymentModule } from './payment.module';

async function bootstrap() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(PaymentModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'payment_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.listen();
  console.log(`[PaymentService] RabbitMQ microservice listening on ${rabbitmqUrl} (queue: payment_queue)`);
}

bootstrap();
