import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Venue } from './entities/venue.entity';
import { Event } from './entities/event.entity';
import { Outbox } from './entities/outbox.entity';
import { ElasticsearchService } from './services/elasticsearch.service';
import { OutboxRelayService } from './services/outbox-relay.service';
import { EventIndexerConsumer } from './consumers/event-indexer.consumer';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'ticketing',
      entities: [Venue, Event, Outbox],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Venue, Event, Outbox]),
  ],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    ElasticsearchService,
    OutboxRelayService,
    EventIndexerConsumer,
  ],
})
export class CatalogModule {}
