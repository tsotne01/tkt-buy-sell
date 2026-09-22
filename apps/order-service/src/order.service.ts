import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderStatus, RABBITMQ_EVENTS, OrderCreatedEvent } from '@tkt/common';

export interface OrderEntity {
  id: string;
  user_id: string;
  ticket_id: string;
  event_id: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  qr_code: string;
  error_message: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private orders: Map<string, OrderEntity> = new Map();

  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy
  ) {}

  async createOrder(data: { user_id: string; ticket_id: string; event_id: string; amount: number }): Promise<OrderEntity> {
    const orderId = `ord_${Date.now()}`;
    const newOrder: OrderEntity = {
      id: orderId,
      user_id: data.user_id,
      ticket_id: data.ticket_id,
      event_id: data.event_id,
      amount: data.amount,
      status: OrderStatus.PENDING,
      created_at: new Date().toISOString(),
      qr_code: '',
      error_message: '',
    };

    this.orders.set(orderId, newOrder);
    this.logger.log(`Created Order ${orderId} in PENDING status. Publishing ${RABBITMQ_EVENTS.ORDER_CREATED}...`);

    // Emit event onto RabbitMQ to start Saga payment process
    const eventPayload: OrderCreatedEvent = {
      orderId: newOrder.id,
      userId: newOrder.user_id,
      ticketId: newOrder.ticket_id,
      eventId: newOrder.event_id,
      amount: newOrder.amount,
      timestamp: new Date().toISOString(),
    };

    try {
      this.rabbitClient.emit(RABBITMQ_EVENTS.ORDER_CREATED, eventPayload);
    } catch (err: any) {
      this.logger.warn(`Failed to emit RabbitMQ order.created: ${err.message}`);
    }

    return newOrder;
  }

  getOrderById(orderId: string): OrderEntity {
    const order = this.orders.get(orderId);
    if (!order) {
      return {
        id: '',
        user_id: '',
        ticket_id: '',
        event_id: '',
        amount: 0,
        status: OrderStatus.CANCELLED,
        created_at: '',
        qr_code: '',
        error_message: 'Order not found',
      };
    }
    return order;
  }

  getUserOrders(userId: string): { orders: OrderEntity[] } {
    const userOrders: OrderEntity[] = [];
    for (const order of this.orders.values()) {
      if (order.user_id === userId) {
        userOrders.push(order);
      }
    }
    return { orders: userOrders };
  }

  cancelOrder(orderId: string, reason: string): OrderEntity {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = OrderStatus.CANCELLED;
    order.error_message = reason;
    this.logger.log(`Order ${orderId} marked CANCELLED. Emitting ${RABBITMQ_EVENTS.ORDER_CANCELLED}...`);

    try {
      this.rabbitClient.emit(RABBITMQ_EVENTS.ORDER_CANCELLED, {
        orderId: order.id,
        ticketId: order.ticket_id,
        userId: order.user_id,
        reason,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to emit RabbitMQ cancel event: ${err.message}`);
    }

    return order;
  }

  markOrderCompleted(orderId: string, ticketId: string) {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = OrderStatus.COMPLETED;
      order.qr_code = `QR-PASS-${order.event_id}-${ticketId}-${order.id}`;
      this.logger.log(`Order ${orderId} marked COMPLETED! Pass QR: ${order.qr_code}`);
    }
  }

  markOrderFailed(orderId: string, reason: string) {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = OrderStatus.CANCELLED;
      order.error_message = reason;
      this.logger.warn(`Order ${orderId} marked FAILED: ${reason}`);
    }
  }
}
