import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';
import { AssignmentsModule } from '../assignments/assignments.module';
import { InternalEventsController } from './internal-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), AssignmentsModule],
  controllers: [EventsController, InternalEventsController],
  providers: [EventsService, EventsResolver],
  exports: [EventsService],
})
export class EventsModule {}
