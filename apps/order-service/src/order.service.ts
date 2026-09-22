import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { OrderStatus, RABBITMQ_EVENTS, OrderCreatedEvent } from '@tkt/common';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy
  ) {}

  async createOrder(data: { user_id: string; ticket_id: string; event_id: string; amount: number }): Promise<Order> {
    const orderId = `ord_${Date.now()}`;
    const newOrder = await this.orderRepo.save({
      id: orderId,
      user_id: data.user_id,
      ticket_id: data.ticket_id,
      event_id: data.event_id,
      amount: Number(data.amount) || 0,
      status: OrderStatus.PENDING,
      created_at: new Date().toISOString(),
      qr_code: '',
      error_message: '',
    });

    this.logger.log(`Created Order ${orderId} in PostgreSQL (PENDING). Publishing ${RABBITMQ_EVENTS.ORDER_CREATED}...`);

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

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
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

  async getUserOrders(userId: string): Promise<{ orders: Order[] }> {
    const orders = await this.orderRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    return { orders };
  }

  async cancelOrder(orderId: string, reason: string): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = OrderStatus.CANCELLED;
    order.error_message = reason;
    await this.orderRepo.save(order);
    this.logger.log(`Order ${orderId} marked CANCELLED in PostgreSQL. Emitting ${RABBITMQ_EVENTS.ORDER_CANCELLED}...`);

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

  async markOrderCompleted(orderId: string, ticketId: string) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (order) {
      order.status = OrderStatus.COMPLETED;
      order.qr_code = `QR-PASS-${order.event_id}-${ticketId}-${order.id}`;
      await this.orderRepo.save(order);
      this.logger.log(`Order ${orderId} marked COMPLETED in PostgreSQL! Pass QR: ${order.qr_code}`);
    }
  }

  async markOrderFailed(orderId: string, reason: string) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (order) {
      order.status = OrderStatus.CANCELLED;
      order.error_message = reason;
      await this.orderRepo.save(order);
      this.logger.warn(`Order ${orderId} marked FAILED in PostgreSQL: ${reason}`);
    }
  }
}
