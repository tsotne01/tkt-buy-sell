import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { NotificationModule } from './notification.module';

async function bootstrap() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(NotificationModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.listen();
  console.log(`[NotificationService] RabbitMQ worker listening on ${rabbitmqUrl} (queue: notification_queue)`);
}

bootstrap();
