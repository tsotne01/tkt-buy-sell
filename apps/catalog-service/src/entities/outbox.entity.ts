import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('outbox')
export class Outbox {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  aggregate_type!: string;

  @Column({ type: 'varchar', length: 64 })
  aggregate_id!: string;

  @Column({ type: 'varchar', length: 128 })
  event_type!: string;

  @Column({ type: 'jsonb' })
  payload!: any;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at?: Date | null;
}
