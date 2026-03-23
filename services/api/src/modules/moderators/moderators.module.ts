import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Moderator } from './moderator.entity';
import { ModeratorsService } from './moderators.service';

@Module({
  imports: [TypeOrmModule.forFeature([Moderator])],
  providers: [ModeratorsService],
  exports: [ModeratorsService],
})
export class ModeratorsModule {}
