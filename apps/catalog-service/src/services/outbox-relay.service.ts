import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { Outbox } from '../entities/outbox.entity';
import { RABBITMQ_EXCHANGE } from '@tkt/common';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private connection: any = null;
  private channel: any = null;
  private isProcessing = false;
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Outbox)
    private readonly outboxRepo: Repository<Outbox>,
  ) {}

  async onModuleInit() {
    await this.connectRabbitMQ();
    // Background polling loop to guarantee any missed or pending records get relayed
    this.intervalRef = setInterval(() => this.processPendingOutbox(), 4000);
  }

  async onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {}
  }

  private async connectRabbitMQ(): Promise<boolean> {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    try {
      this.logger.log(`Connecting to RabbitMQ at ${rabbitmqUrl}...`);
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
      this.logger.log(`RabbitMQ confirm channel ready for outbox relay on '${RABBITMQ_EXCHANGE}'.`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to connect to RabbitMQ for Outbox relay: ${err.message}. Will retry.`);
      return false;
    }
  }

  async processPendingOutbox(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (!this.channel) {
        const connected = await this.connectRabbitMQ();
        if (!connected) return;
      }

      const pendingRecords = await this.outboxRepo.find({
        where: { status: 'PENDING' },
        take: 50,
        order: { created_at: 'ASC' },
      });

      if (pendingRecords.length === 0) return;

      this.logger.log(`Processing ${pendingRecords.length} pending outbox records...`);

      for (const record of pendingRecords) {
        try {
          await new Promise<void>((resolve, reject) => {
            this.channel.publish(
              RABBITMQ_EXCHANGE,
              record.event_type,
              Buffer.from(JSON.stringify(record.payload)),
              { persistent: true },
              (err: any) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });

          record.status = 'PUBLISHED';
          record.published_at = new Date();
          await this.outboxRepo.save(record);
          this.logger.log(`Outbox record '${record.id}' (${record.event_type}) confirmed & published.`);
        } catch (pubErr: any) {
          this.logger.error(`Failed to publish outbox record '${record.id}': ${pubErr.message}`);
          break; // Stop and retry on next interval
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in outbox processing loop: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
