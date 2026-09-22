import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('tickets')
export class Ticket {
  @PrimaryColumn()
  id!: string;

  @Index()
  @Column()
  event_id!: string;

  @Column()
  section!: string;

  @Column()
  row!: string;

  @Column({ default: 0 })
  seat_number!: number;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number(v) || 0,
    },
  })
  price!: number;

  @Column({ default: 'AVAILABLE' })
  status!: string;

  @Column({ default: '' })
  held_by_user_id!: string;

  @Column('double precision', { default: 0 })
  hold_expires_at!: number;

  @Column({ default: false })
  is_resale!: boolean;

  @Column({ default: '' })
  seller_id!: string;
}
