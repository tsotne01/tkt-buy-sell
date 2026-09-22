import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface EventDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  venue_id: string;
  venue_name: string;
  city: string;
  date: string;
  min_price: number;
  total_seats: number;
  available_seats: number;
  image_url: string;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client!: Client;
  private readonly indexName = 'events';
  private connected = false;

  async onModuleInit() {
    const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    this.logger.log(`Initializing Elasticsearch client targeting ${node}...`);
    this.client = new Client({ node });

    try {
      await this.initIndex();
      this.connected = true;
      this.logger.log(`Elasticsearch connected and index '${this.indexName}' is ready.`);
    } catch (err: any) {
      this.logger.warn(`Could not connect to Elasticsearch at ${node} (${err.message}). Catalog will use DB fallback.`);
      this.connected = false;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async initIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (!exists) {
      this.logger.log(`Creating index '${this.indexName}' with typo-tolerant fuzzy analyzer...`);
      await this.client.indices.create({
        index: this.indexName,
        settings: {
          analysis: {
            analyzer: {
              event_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'event_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            description: {
              type: 'text',
              analyzer: 'event_analyzer',
            },
            category: { type: 'keyword' },
            venue_id: { type: 'keyword' },
            venue_name: {
              type: 'text',
              analyzer: 'event_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            city: {
              type: 'text',
              analyzer: 'event_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            date: { type: 'date' },
            min_price: { type: 'double' },
            total_seats: { type: 'integer' },
            available_seats: { type: 'integer' },
            image_url: { type: 'keyword', index: false },
          },
        },
      });
      this.logger.log(`Index '${this.indexName}' created successfully.`);
    }
  }

  async indexEvent(event: EventDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: event.id,
        document: event,
        refresh: 'wait_for',
      });
      this.logger.log(`Indexed event document '${event.id}' into Elasticsearch.`);
    } catch (err: any) {
      this.logger.error(`Failed to index event '${event.id}': ${err.message}`);
      throw err;
    }
  }

  async bulkIndex(events: EventDocument[]): Promise<void> {
    if (!events || events.length === 0) return;
    try {
      const operations = events.flatMap((doc) => [{ index: { _index: this.indexName, _id: doc.id } }, doc]);
      const bulkResponse = await this.client.bulk({ refresh: true, operations });
      if (bulkResponse.errors) {
        this.logger.warn('Some errors occurred during bulk indexing');
      } else {
        this.logger.log(`Bulk indexed ${events.length} events into Elasticsearch.`);
      }
    } catch (err: any) {
      this.logger.error(`Bulk index error: ${err.message}`);
    }
  }

  async searchEvents(query: { search?: string; category?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 20);
    // Guard from offset so it never exceeds Elasticsearch max_result_window (10,000)
    const from = Math.min((page - 1) * limit, Math.max(0, 10000 - limit));

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (query.search && query.search.trim() !== '') {
      mustClauses.push({
        multi_match: {
          query: query.search.trim(),
          fields: ['title^3', 'venue_name^2', 'city^2', 'description'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    if (query.category && query.category.trim() !== '' && query.category !== 'All') {
      filterClauses.push({
        term: { category: query.category.trim() },
      });
    }

    const response = await this.client.search<EventDocument>({
      index: this.indexName,
      from,
      size: limit,
      track_total_hits: true,
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
    });

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || 0;

    const events = response.hits.hits.map((hit) => hit._source as EventDocument);

    return {
      events,
      total,
      page,
      took: response.took,
    };
  }
}
