import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { Event } from '../events/event.entity';
import { Moderator } from '../moderators/moderator.entity';

registerEnumType(AssignmentStatus, { name: 'AssignmentStatus' });

@ObjectType()
@Entity({ name: 'assignments' })
@Index(['status', 'expiresAt'])
@Index(['moderatorId', 'status'])
export class Assignment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field(() => ID)
  @Column('uuid')
  eventId!: string;

  @Field(() => ID)
  @Column('uuid')
  moderatorId!: string;

  @Field(() => AssignmentStatus)
  @Column({ type: 'enum', enum: AssignmentStatus })
  status!: AssignmentStatus;

  @Field()
  @CreateDateColumn()
  claimedAt!: Date;

  @Field()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date;

  @ManyToOne(() => Event, (event) => event.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event!: Event;

  @ManyToOne(() => Moderator, (moderator) => moderator.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moderatorId' })
  moderator!: Moderator;
}
