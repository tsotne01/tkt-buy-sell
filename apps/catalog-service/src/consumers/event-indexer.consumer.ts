import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ElasticsearchService, EventDocument } from '../services/elasticsearch.service';
import { RABBITMQ_EXCHANGE, RABBITMQ_EVENTS } from '@tkt/common';

@Injectable()
export class EventIndexerConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventIndexerConsumer.name);
  private connection: any = null;
  private channel: any = null;
  private readonly queueName = 'catalog_search_indexer_queue';

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    // Delay slightly to give Elasticsearch and RabbitMQ time to finish ready state
    setTimeout(() => this.startConsuming(), 3000);
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {}
  }

  private async startConsuming() {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    try {
      this.logger.log(`Starting RabbitMQ Indexer Consumer on ${rabbitmqUrl}...`);
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(this.queueName, { durable: true });

      // Bind to catalog event patterns
      await this.channel.bindQueue(this.queueName, RABBITMQ_EXCHANGE, 'catalog.event.*');
      await this.channel.prefetch(10);

      this.logger.log(`Queue '${this.queueName}' bound to '${RABBITMQ_EXCHANGE}' for 'catalog.event.*'. Waiting for events...`);

      this.channel.consume(
        this.queueName,
        async (msg: any) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            this.logger.log(`Received catalog event for indexing: ${content.id || content.title}`);

            const doc: EventDocument = {
              id: content.id,
              title: content.title,
              description: content.description || '',
              category: content.category || 'Concerts',
              venue_id: content.venue_id || '',
              venue_name: content.venue_name || '',
              city: content.city || '',
              date: content.date || new Date().toISOString(),
              min_price: Number(content.min_price) || 0,
              total_seats: Number(content.total_seats) || 0,
              available_seats: Number(content.available_seats) || 0,
              image_url: content.image_url || '',
            };

            await this.elasticsearchService.indexEvent(doc);
            this.channel.ack(msg);
            this.logger.log(`Successfully indexed event '${doc.id}' and acknowledged RabbitMQ message.`);
          } catch (err: any) {
            this.logger.error(`Error indexing event from RabbitMQ: ${err.message}`);
            // Re-queue so it can retry
            this.channel.nack(msg, false, true);
          }
        },
        { noAck: false }
      );
    } catch (err: any) {
      this.logger.error(`Failed to initialize EventIndexerConsumer: ${err.message}. Retrying in 5s...`);
      setTimeout(() => this.startConsuming(), 5000);
    }
  }
}
