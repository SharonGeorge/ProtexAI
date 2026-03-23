import { Field, ObjectType } from '@nestjs/graphql';
import { Moderator } from '../../moderators/moderator.entity';

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken!: string;

  @Field(() => Moderator)
  moderator!: Moderator;
}
