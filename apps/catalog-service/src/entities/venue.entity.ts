import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  city!: string;

  @Column({ default: 0 })
  capacity!: number;
}
