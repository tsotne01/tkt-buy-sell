import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column()
  category!: string;

  @Column()
  venue_id!: string;

  @Column()
  venue_name!: string;

  @Column()
  city!: string;

  @Column()
  date!: string;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number(v) || 0,
    },
  })
  min_price!: number;

  @Column({ default: 0 })
  total_seats!: number;

  @Column({ default: 0 })
  available_seats!: number;

  @Column()
  image_url!: string;
}
