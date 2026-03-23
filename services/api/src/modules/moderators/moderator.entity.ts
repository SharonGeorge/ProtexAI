import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Region } from '../../common/enums/region.enum';
import { Assignment } from '../assignments/assignment.entity';

registerEnumType(Region, { name: 'Region' });

@ObjectType()
@Entity({ name: 'moderators' })
export class Moderator {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ unique: true })
  userId!: string;

  @Field(() => Region)
  @Column({ type: 'enum', enum: Region })
  region!: Region;

  @OneToMany(() => Assignment, (assignment) => assignment.moderator)
  assignments!: Assignment[];
}
