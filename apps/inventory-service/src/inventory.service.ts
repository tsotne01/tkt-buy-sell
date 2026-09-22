import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { TicketStatus } from '@tkt/common';

export interface TicketEntity {
  id: string;
  event_id: string;
  section: string;
  row: string;
  seat_number: number;
  price: number;
  status: TicketStatus;
  held_by_user_id: string;
  hold_expires_at: number;
  is_resale: boolean;
  seller_id: string;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);
  private redisClient: Redis | null = null;
  private tickets: Map<string, TicketEntity> = new Map();

  // In-memory fallback TTL store if Redis is connecting/unavailable locally
  private memoryHolds: Map<string, { userId: string; expiresAt: number }> = new Map();

  onModuleInit() {
    this.initRedis();
    this.seedTickets();
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
        this.logger.warn(`Redis unavailable (${err.message}). Using resilient in-memory TTL lock.`);
        this.redisClient = null;
      });
    } catch {
      this.logger.warn('Failed to initialize Redis client. Falling back to in-memory store.');
    }
  }

  private seedTickets() {
    // Generate seats for evt_1 (Coldplay at Wembley)
    const sections = ['VIP Lower', 'Section 102', 'General Standing'];
    let counter = 1;

    for (const section of sections) {
      for (let r = 1; r <= 3; r++) {
        for (let s = 1; s <= 6; s++) {
          const id = `tkt_evt1_${counter++}`;
          const price = section === 'VIP Lower' ? 180 : section === 'Section 102' ? 110 : 85;
          this.tickets.set(id, {
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

    // Seed one resale ticket for demonstration
    const resaleTicket: TicketEntity = {
      id: 'tkt_evt1_resale_99',
      event_id: 'evt_1',
      section: 'VIP Lower',
      row: 'A',
      seat_number: 99,
      price: 160,
      status: TicketStatus.AVAILABLE,
      held_by_user_id: '',
      hold_expires_at: 0,
      is_resale: true,
      seller_id: 'usr_seller_1',
    };
    this.tickets.set(resaleTicket.id, resaleTicket);

    // Also seed a few tickets for evt_2, evt_3, evt_4
    const otherEvents = ['evt_2', 'evt_3', 'evt_4'];
    for (const evtId of otherEvents) {
      for (let s = 1; s <= 10; s++) {
        const id = `tkt_${evtId}_${s}`;
        this.tickets.set(id, {
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
  }

  getTicketsForEvent(eventId: string) {
    this.cleanupExpiredHolds();
    const result: TicketEntity[] = [];
    for (const ticket of this.tickets.values()) {
      if (ticket.event_id === eventId) {
        result.push(ticket);
      }
    }
    return { tickets: result };
  }

  async reserveTicketHold(ticketId: string, userId: string, holdSeconds = 600) {
    this.cleanupExpiredHolds();
    const ticket = this.tickets.get(ticketId);

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
        this.logger.warn(`Redis lock error, falling back to memory: ${err.message}`);
      }
    }

    // Check memory lock
    const existingHold = this.memoryHolds.get(ticketId);
    if (existingHold && existingHold.expiresAt > Date.now() && existingHold.userId !== userId) {
      return {
        success: false,
        ticket_id: ticketId,
        hold_expires_at: 0,
        error_message: 'Ticket is currently held by another buyer.',
      };
    }

    // Acquire hold
    this.memoryHolds.set(ticketId, { userId, expiresAt });
    ticket.status = TicketStatus.HELD;
    ticket.held_by_user_id = userId;
    ticket.hold_expires_at = expiresAt;

    this.logger.log(`Ticket ${ticketId} reserved for user ${userId} until ${new Date(expiresAt).toISOString()}`);

    return {
      success: true,
      ticket_id: ticketId,
      hold_expires_at: expiresAt,
      error_message: '',
    };
  }

  async releaseTicketHold(ticketId: string, userId: string) {
    const ticket = this.tickets.get(ticketId);
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

    this.memoryHolds.delete(ticketId);
    if (ticket.status === TicketStatus.HELD) {
      ticket.status = TicketStatus.AVAILABLE;
      ticket.held_by_user_id = '';
      ticket.hold_expires_at = 0;
      this.logger.log(`Ticket ${ticketId} hold released and back to AVAILABLE.`);
    }

    return { success: true, ticket_id: ticketId, message: 'Hold released successfully' };
  }

  confirmTicketSold(ticketId: string, userId: string, orderId: string) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, ticket_id: ticketId, qr_code: '' };
    }

    ticket.status = TicketStatus.SOLD;
    ticket.held_by_user_id = userId;
    ticket.hold_expires_at = 0;
    this.memoryHolds.delete(ticketId);

    if (this.redisClient) {
      this.redisClient.del(`ticket:hold:${ticketId}`).catch(() => {});
    }

    // Mock secure dynamic QR Code payload (can be validated at venue entrance)
    const qrCode = `TKT-${ticket.event_id}-${ticket.id}-${orderId}-${Date.now()}`;
    this.logger.log(`Ticket ${ticketId} officially SOLD to user ${userId} for order ${orderId}!`);

    return {
      success: true,
      ticket_id: ticketId,
      qr_code: qrCode,
    };
  }

  listResaleTicket(ticketId: string, sellerId: string, resalePrice: number): TicketEntity {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.is_resale = true;
    ticket.seller_id = sellerId;
    ticket.price = resalePrice;
    ticket.status = TicketStatus.AVAILABLE;
    ticket.held_by_user_id = '';
    ticket.hold_expires_at = 0;

    this.logger.log(`Ticket ${ticketId} listed for P2P resale by ${sellerId} at $${resalePrice}`);
    return ticket;
  }

  private cleanupExpiredHolds() {
    const now = Date.now();
    for (const [ticketId, hold] of this.memoryHolds.entries()) {
      if (hold.expiresAt <= now) {
        this.memoryHolds.delete(ticketId);
        const ticket = this.tickets.get(ticketId);
        if (ticket && ticket.status === TicketStatus.HELD) {
          ticket.status = TicketStatus.AVAILABLE;
          ticket.held_by_user_id = '';
          ticket.hold_expires_at = 0;
          this.logger.log(`Hold on ticket ${ticketId} expired. Seat released to AVAILABLE.`);
        }
      }
    }
  }
}
