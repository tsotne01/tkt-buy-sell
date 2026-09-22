import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Venue } from './entities/venue.entity';
import { Event } from './entities/event.entity';

export interface EventItem {
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

export interface VenueItem {
  id: string;
  name: string;
  city: string;
  capacity: number;
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>
  ) {}

  async onModuleInit() {
    const venueCount = await this.venueRepo.count();
    if (venueCount === 0) {
      this.logger.log('Seeding venues into PostgreSQL...');
      await this.venueRepo.save([
        { id: 'ven_1', name: 'Madison Square Garden', city: 'New York', capacity: 20000 },
        { id: 'ven_2', name: 'O2 Arena', city: 'London', capacity: 20000 },
        { id: 'ven_3', name: 'Wembley Stadium', city: 'London', capacity: 90000 },
        { id: 'ven_4', name: 'Staples Center', city: 'Los Angeles', capacity: 19000 },
      ]);
      this.logger.log('Venues seeded successfully.');
    }

    const eventCount = await this.eventRepo.count();
    if (eventCount === 0) {
      this.logger.log('Seeding events into PostgreSQL...');
      await this.eventRepo.save([
        {
          id: 'evt_1',
          title: 'Coldplay - Music of the Spheres World Tour',
          description: 'Experience Coldplay live in concert with an immersive stadium spectacle.',
          category: 'Concerts',
          venue_id: 'ven_3',
          venue_name: 'Wembley Stadium',
          city: 'London',
          date: '2026-10-15T19:30:00Z',
          min_price: 85.0,
          total_seats: 500,
          available_seats: 320,
          image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        },
        {
          id: 'evt_2',
          title: 'UEFA Champions League Final 2026',
          description: 'The pinnacle of European club football. Watch the two finest clubs battle for glory.',
          category: 'Sports',
          venue_id: 'ven_3',
          venue_name: 'Wembley Stadium',
          city: 'London',
          date: '2026-11-28T20:00:00Z',
          min_price: 150.0,
          total_seats: 800,
          available_seats: 120,
          image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        },
        {
          id: 'evt_3',
          title: 'Hans Zimmer Live - The Symphony',
          description: 'The legendary film composer performs masterpieces from Interstellar, Gladiator, and Inception.',
          category: 'Concerts',
          venue_id: 'ven_1',
          venue_name: 'Madison Square Garden',
          city: 'New York',
          date: '2026-12-05T19:00:00Z',
          min_price: 95.0,
          total_seats: 400,
          available_seats: 250,
          image_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
        },
        {
          id: 'evt_4',
          title: 'Hamilton - The Award-Winning Musical',
          description: 'Lin-Manuel Miranda’s groundbreaking musical drama featuring revolutionary history in hip-hop.',
          category: 'Theater',
          venue_id: 'ven_4',
          venue_name: 'Staples Center',
          city: 'Los Angeles',
          date: '2026-10-22T20:00:00Z',
          min_price: 70.0,
          total_seats: 300,
          available_seats: 195,
          image_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
        },
      ]);
      this.logger.log('Events seeded successfully in PostgreSQL.');
    }
  }

  async getEvents(query: { search?: string; category?: string; page?: number; limit?: number }) {
    let events = await this.eventRepo.find();

    if (query.category && query.category.trim() !== '') {
      events = events.filter(
        (e) => e.category.toLowerCase() === query.category!.toLowerCase()
      );
    }

    if (query.search && query.search.trim() !== '') {
      const s = query.search.toLowerCase();
      events = events.filter(
        (e) => e.title.toLowerCase().includes(s) || e.city.toLowerCase().includes(s) || e.venue_name.toLowerCase().includes(s)
      );
    }

    return {
      events,
      total: events.length,
      page: query.page || 1,
    };
  }

  async getEventById(id: string): Promise<EventItem> {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) {
      return {
        id: '',
        title: '',
        description: '',
        category: '',
        venue_id: '',
        venue_name: '',
        city: '',
        date: '',
        min_price: 0,
        total_seats: 0,
        available_seats: 0,
        image_url: '',
      };
    }
    return event;
  }

  async createEvent(data: Partial<EventItem>): Promise<EventItem> {
    const venues = await this.venueRepo.find();
    const venue = venues.find((v) => v.id === data.venue_id) || venues[0];
    const newEvent: Event = {
      id: `evt_${Date.now()}`,
      title: data.title || 'Untitled Event',
      description: data.description || '',
      category: data.category || 'Concerts',
      venue_id: venue.id,
      venue_name: venue.name,
      city: venue.city,
      date: data.date || new Date().toISOString(),
      min_price: Number(data.min_price) || 50.0,
      total_seats: data.total_seats || 100,
      available_seats: data.total_seats || 100,
      image_url: data.image_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    };

    await this.eventRepo.save(newEvent);
    return newEvent;
  }

  async getVenues() {
    const venues = await this.venueRepo.find();
    return { venues };
  }
}
