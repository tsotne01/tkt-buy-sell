import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import Redis from 'ioredis';
import { TicketStatus } from '@tkt/common';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);
  private redisClient: Redis | null = null;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>
  ) {
    this.initRedis();
  }

  async onModuleInit() {
    const count = await this.ticketRepo.count();
    if (count === 0) {
      await this.seedTickets();
    }
  }

  private initRedis() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    try {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => 3000,
      });

      this.redisClient.connect().then(() => {
        this.logger.log(`Connected to Redis at ${redisHost}:${redisPort}`);
      }).catch((err) => {
        this.logger.warn(`Redis unavailable (${err.message}).`);
        this.redisClient = null;
      });
    } catch {
      this.logger.warn('Failed to initialize Redis client.');
    }
  }

  private async seedTickets() {
    this.logger.log('Seeding tickets into PostgreSQL tickets table...');
    const ticketsToSeed: Partial<Ticket>[] = [];

    // Generate seats for evt_1 (Coldplay at Wembley)
    const sections = ['VIP Lower', 'Section 102', 'General Standing'];
    let counter = 1;

    for (const section of sections) {
      for (let r = 1; r <= 3; r++) {
        for (let s = 1; s <= 6; s++) {
          const id = `tkt_evt1_${counter++}`;
          const price = section === 'VIP Lower' ? 180 : section === 'Section 102' ? 110 : 85;
          ticketsToSeed.push({
            id,
            event_id: 'evt_1',
            section,
            row: String.fromCharCode(64 + r),
            seat_number: s,
            price,
            status: TicketStatus.AVAILABLE,
            held_by_user_id: '',
            hold_expires_at: 0,
            is_resale: false,
            seller_id: '',
          });
        }
      }
    }

    // Seed a few tickets for evt_2, evt_3, evt_4
    const otherEvents = ['evt_2', 'evt_3', 'evt_4'];
    for (const evtId of otherEvents) {
      for (let s = 1; s <= 10; s++) {
        const id = `tkt_${evtId}_${s}`;
        ticketsToSeed.push({
          id,
          event_id: evtId,
          section: 'Standard Area',
          row: 'A',
          seat_number: s,
          price: evtId === 'evt_2' ? 150 : evtId === 'evt_3' ? 95 : 70,
          status: TicketStatus.AVAILABLE,
          held_by_user_id: '',
          hold_expires_at: 0,
          is_resale: false,
          seller_id: '',
        });
      }
    }

    await this.ticketRepo.save(ticketsToSeed);
    this.logger.log(`Successfully seeded ${ticketsToSeed.length} tickets in PostgreSQL.`);
  }

  async provisionEventSeats(eventId: string): Promise<Ticket[]> {
    const sections = ['VIP Lower', 'Section 102', 'General Standing'];
    const ticketsToSeed: Partial<Ticket>[] = [];
    let counter = 1;

    for (const section of sections) {
      for (let r = 1; r <= 3; r++) {
        for (let s = 1; s <= 6; s++) {
          const id = `tkt_${eventId}_${counter++}`;
          const price = section === 'VIP Lower' ? 180 : section === 'Section 102' ? 110 : 85;
          ticketsToSeed.push({
            id,
            event_id: eventId,
            section,
            row: String.fromCharCode(64 + r),
            seat_number: s,
            price,
            status: TicketStatus.AVAILABLE,
            held_by_user_id: '',
            hold_expires_at: 0,
            is_resale: false,
            seller_id: '',
          });
        }
      }
    }

    try {
      await this.ticketRepo.save(ticketsToSeed);
      this.logger.log(`Provisioned ${ticketsToSeed.length} seats for event '${eventId}' in PostgreSQL.`);
    } catch (err: any) {
      this.logger.warn(`Seat provisioning note for ${eventId}: ${err.message}`);
    }

    return (await this.ticketRepo.find({
      where: { event_id: eventId },
      order: { section: 'ASC', row: 'ASC', seat_number: 'ASC' },
    })) as Ticket[];
  }

  async getTicketsForEvent(eventId: string) {
    await this.cleanupExpiredHolds();
    let tickets = await this.ticketRepo.find({
      where: { event_id: eventId },
      order: { section: 'ASC', row: 'ASC', seat_number: 'ASC' },
    });

    if (!tickets || tickets.length === 0) {
      tickets = await this.provisionEventSeats(eventId);
    }

    return { tickets };
  }

  async reserveTicketHold(ticketId: string, userId: string, holdSeconds = 600) {
    await this.cleanupExpiredHolds();
    const ticket = await this.resolveTicket(ticketId);

    if (!ticket) {
      return {
        success: false,
        ticket_id: ticketId,
        hold_expires_at: 0,
        error_message: 'Ticket does not exist',
      };
    }

    if (ticket.status === TicketStatus.SOLD) {
      return {
        success: false,
        ticket_id: ticketId,
        hold_expires_at: 0,
        error_message: 'Ticket is already sold',
      };
    }

    const expiresAt = Date.now() + holdSeconds * 1000;
    const lockKey = `ticket:hold:${ticketId}`;

    if (this.redisClient) {
      try {
        // Atomic lock in Redis: SET lockKey userId NX EX holdSeconds
        const result = await this.redisClient.set(lockKey, userId, 'EX', holdSeconds, 'NX');
        if (!result) {
          return {
            success: false,
            ticket_id: ticketId,
            hold_expires_at: 0,
            error_message: 'Ticket is currently held by another user. Try again later.',
          };
        }
      } catch (err: any) {
        this.logger.warn(`Redis lock error: ${err.message}`);
      }
    }

    // Check if held by another user in DB
    if (ticket.status === TicketStatus.HELD && ticket.hold_expires_at > Date.now() && ticket.held_by_user_id !== userId) {
      return {
        success: false,
        ticket_id: ticketId,
        hold_expires_at: 0,
        error_message: 'Ticket is currently held by another buyer.',
      };
    }

    // Acquire hold and persist in PostgreSQL
    ticket.status = TicketStatus.HELD;
    ticket.held_by_user_id = userId;
    ticket.hold_expires_at = expiresAt;
    await this.ticketRepo.save(ticket);

    this.logger.log(`Ticket ${ticketId} reserved in DB for user ${userId} until ${new Date(expiresAt).toISOString()}`);

    return {
      success: true,
      ticket_id: ticketId,
      hold_expires_at: expiresAt,
      error_message: '',
    };
  }

  private async resolveTicket(ticketId: string): Promise<Ticket | null> {
    let ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket && ticketId.includes('evt_1')) {
      ticket = await this.ticketRepo.findOneBy({ id: ticketId.replace('evt_1', 'evt1') });
    }
    if (!ticket && ticketId.includes('evt1')) {
      ticket = await this.ticketRepo.findOneBy({ id: ticketId.replace('evt1', 'evt_1') });
    }
    if (!ticket) {
      const match = ticketId.match(/^tkt_(.+)_(\d+)$/);
      if (match) {
        const eventId = match[1];
        await this.provisionEventSeats(eventId);
        ticket = await this.ticketRepo.findOneBy({ id: ticketId });
      }
    }
    return ticket;
  }

  async releaseTicketHold(ticketId: string, userId: string) {
    const ticket = await this.resolveTicket(ticketId);
    if (!ticket) {
      return { success: false, ticket_id: ticketId, message: 'Ticket not found' };
    }

    // Release in Redis
    if (this.redisClient) {
      try {
        await this.redisClient.del(`ticket:hold:${ticketId}`);
      } catch (err: any) {
        this.logger.warn(`Redis del error: ${err.message}`);
      }
    }

    if (ticket.status === TicketStatus.HELD) {
      ticket.status = TicketStatus.AVAILABLE;
      ticket.held_by_user_id = '';
      ticket.hold_expires_at = 0;
      await this.ticketRepo.save(ticket);
      this.logger.log(`Ticket ${ticketId} hold released in DB and back to AVAILABLE.`);
    }

    return { success: true, ticket_id: ticketId, message: 'Hold released successfully' };
  }

  async confirmTicketSold(ticketId: string, userId: string, orderId: string) {
    const ticket = await this.resolveTicket(ticketId);
    if (!ticket) {
      return { success: false, ticket_id: ticketId, qr_code: '' };
    }

    ticket.status = TicketStatus.SOLD;
    ticket.held_by_user_id = userId;
    ticket.hold_expires_at = 0;
    ticket.is_resale = false;
    await this.ticketRepo.save(ticket);

    if (this.redisClient) {
      this.redisClient.del(`ticket:hold:${ticketId}`).catch(() => {});
    }

    // Mock secure dynamic QR Code payload (can be validated at venue entrance)
    const qrCode = `TKT-${ticket.event_id}-${ticket.id}-${orderId}-${Date.now()}`;
    this.logger.log(`Ticket ${ticketId} officially SOLD in DB to user ${userId} for order ${orderId}!`);

    return {
      success: true,
      ticket_id: ticketId,
      qr_code: qrCode,
    };
  }

  async listResaleTicket(ticketId: string, sellerId: string, resalePrice: number) {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.is_resale = true;
    ticket.seller_id = sellerId;
    ticket.price = Number(resalePrice);
    ticket.status = TicketStatus.AVAILABLE;
    ticket.held_by_user_id = '';
    ticket.hold_expires_at = 0;

    await this.ticketRepo.save(ticket);
    this.logger.log(`Ticket ${ticketId} listed for P2P resale in DB by ${sellerId} at $${resalePrice}`);
    return {
      id: ticket.id,
      event_id: ticket.event_id,
      section: ticket.section,
      row: ticket.row,
      seat_number: ticket.seat_number,
      price: Number(ticket.price),
      status: ticket.status,
      held_by_user_id: ticket.held_by_user_id || '',
      hold_expires_at: ticket.hold_expires_at || 0,
      is_resale: ticket.is_resale,
      seller_id: ticket.seller_id || '',
    };
  }

  async getResaleTickets(eventId?: string): Promise<{ tickets: any[] }> {
    const where: any = {
      is_resale: true,
      status: TicketStatus.AVAILABLE,
    };
    if (eventId) {
      where.event_id = eventId;
    }
    const tickets = await this.ticketRepo.find({
      where,
      order: { price: 'ASC' },
    });
    this.logger.log(`Found ${tickets.length} available P2P resale tickets in PostgreSQL`);
    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        event_id: t.event_id,
        section: t.section,
        row: t.row,
        seat_number: t.seat_number,
        price: Number(t.price),
        status: t.status,
        held_by_user_id: t.held_by_user_id || '',
        hold_expires_at: t.hold_expires_at || 0,
        is_resale: t.is_resale,
        seller_id: t.seller_id || '',
      })),
    };
  }

  private async cleanupExpiredHolds() {
    const now = Date.now();
    const expiredTickets = await this.ticketRepo.find({
      where: {
        status: TicketStatus.HELD,
        hold_expires_at: LessThanOrEqual(now),
      },
    });

    if (expiredTickets.length > 0) {
      for (const ticket of expiredTickets) {
        if (ticket.hold_expires_at > 0) {
          ticket.status = TicketStatus.AVAILABLE;
          ticket.held_by_user_id = '';
          ticket.hold_expires_at = 0;
          if (this.redisClient) {
            this.redisClient.del(`ticket:hold:${ticket.id}`).catch(() => {});
          }
          this.logger.log(`Hold on ticket ${ticket.id} expired. Released to AVAILABLE in DB.`);
        }
      }
      await this.ticketRepo.save(expiredTickets);
    }
  }
}
