import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Region } from '../../common/enums/region.enum';
import { Assignment } from '../assignments/assignment.entity';
import { EventStatus } from '../../common/enums/event-status.enum';

@ObjectType()
@Entity({ name: 'events' })
@Index(['region', 'status'])
@Index(['region', 'createdAt'])
export class Event {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column()
  title!: string;

  @Field(() => Region)
  @Column({ type: 'enum', enum: Region })
  region!: Region;

  @Field(() => EventStatus)
  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.AVAILABLE })
  status!: EventStatus;

  @Field(() => String)
  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Field()
  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Assignment, (assignment) => assignment.event)
  assignments!: Assignment[];
}
