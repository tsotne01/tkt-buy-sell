// RabbitMQ Constants
export const RABBITMQ_EXCHANGE = 'ticketing.exchange';
export const RABBITMQ_DLX = 'ticketing.dlx';

export const RABBITMQ_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',
  ORDER_EXPIRED: 'order.expired',
  
  PAYMENT_PROCESSING: 'payment.processing',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',

  TICKET_HELD: 'ticket.held',
  TICKET_RELEASED: 'ticket.released',
  TICKET_SOLD: 'ticket.sold',
  TICKET_RESALE_LISTED: 'ticket.resale.listed',

  CATALOG_EVENT_CREATED: 'catalog.event.created',
  CATALOG_EVENT_UPDATED: 'catalog.event.updated',
} as const;

// Enums
export enum TicketStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  SOLD = 'SOLD',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

// Event Payload Interfaces
export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  ticketId: string;
  eventId: string;
  amount: number;
  timestamp: string;
}

export interface PaymentSucceededEvent {
  orderId: string;
  ticketId: string;
  userId: string;
  paymentId: string;
  amount: number;
  timestamp: string;
}

export interface PaymentFailedEvent {
  orderId: string;
  ticketId: string;
  userId: string;
  reason: string;
  timestamp: string;
}

export interface TicketHeldEvent {
  ticketId: string;
  userId: string;
  holdExpiresAt: number;
}

export interface TicketReleasedEvent {
  ticketId: string;
  userId: string;
  reason: string;
}

export interface CatalogEventPayload {
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
  timestamp?: string;
}
