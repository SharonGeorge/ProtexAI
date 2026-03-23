import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtPayload } from '../../common/auth/jwt.strategy';
import { Assignment } from '../assignments/assignment.entity';
import { Event } from './event.entity';
import { EventsService } from './events.service';
import { ConfigService } from '@nestjs/config';
import { AssignmentsService } from '../assignments/assignments.service';

@Resolver()
export class EventsResolver {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  @Query(() => [Event])
  @UseGuards(JwtAuthGuard)
  availableEvents(@CurrentUser() user: JwtPayload) {
    return this.eventsService.getAvailableEvents(user.region as any);
  }

  @Mutation(() => Assignment)
  @UseGuards(JwtAuthGuard)
  claimEvent(@Args('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    const ttl = this.configService.get<number>('ASSIGNMENT_TTL_MINUTES', 15);
    return this.eventsService.claimEvent(eventId, user.moderatorId, user.region as any, ttl);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  acknowledgeEvent(@Args('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.assignmentsService.acknowledgeByEvent(eventId, user.moderatorId);
  }
}
