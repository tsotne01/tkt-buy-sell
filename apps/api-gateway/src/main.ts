import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Connect RabbitMQ microservice for reactive event consumption (Saga results -> WebSockets)
  const rmqUrl = process.env.RABBITMQ_URL || (process.env.NODE_ENV === 'production' ? 'amqp://guest:guest@rabbitmq:5672' : undefined);
  if (rmqUrl) {
    try {
      app.connectMicroservice({
        transport: Transport.RMQ,
        options: {
          urls: [rmqUrl],
          queue: 'gateway_events_queue',
          queueOptions: {
            durable: false,
          },
        },
      });
      await app.startAllMicroservices();
      console.log(`[API Gateway] Connected to RabbitMQ at ${rmqUrl}`);
    } catch (err: any) {
      console.warn(`[API Gateway] Failed to connect to RabbitMQ (${err.message}). Continuing HTTP only.`);
    }
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[API Gateway] HTTP REST Server & WebSockets listening on port ${port}`);
}

bootstrap();
