import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryColumn()
  id!: string;

  @Column()
  user_id!: string;

  @Column()
  ticket_id!: string;

  @Column()
  event_id!: string;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number(v) || 0,
    },
  })
  amount!: number;

  @Column({ default: 'PENDING' })
  status!: string;

  @Column()
  created_at!: string;

  @Column({ default: '' })
  qr_code!: string;

  @Column({ default: '' })
  error_message!: string;
}
