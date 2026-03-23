import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Region } from '../../../common/enums/region.enum';

@InputType()
export class LoginDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @Field(() => Region)
  @IsEnum(Region)
  region!: Region;
}
