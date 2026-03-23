import { Controller, Get, MessageEvent, Param, Post, Sse, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtPayload } from '../../common/auth/jwt.strategy';
import { EventsService } from './events.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { QueryCacheService } from '../../shared/query-cache.service';
import { RealtimeEventsService } from '../../shared/realtime-events.service';

const EVENTS_CACHE_TTL_MS = 5_000;

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
    private readonly assignmentsService: AssignmentsService,
    private readonly queryCacheService: QueryCacheService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  @Get('available')
  getAvailable(@CurrentUser() user: JwtPayload) {
    return this.queryCacheService.getOrSet(
      `events:available:${user.region}`,
      () => this.eventsService.getAvailableEvents(user.region as any),
      EVENTS_CACHE_TTL_MS,
    );
  }

  @Sse('stream')
  stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return this.realtimeEventsService.streamForRegion(user.region);
  }

  @Post('reseed')
  async reseed() {
    const result = await this.eventsService.reseedEventsFromFile();
    this.queryCacheService.invalidateByPrefix('events:available:');
    this.realtimeEventsService.publish({
      type: 'events.reseeded',
      payload: { inserted: result.inserted },
    });
    return result;
  }

  @Post(':eventId/claim')
  async claim(@Param('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    const ttl = this.configService.get<number>('ASSIGNMENT_TTL_MINUTES', 15);
    const assignment = await this.eventsService.claimEvent(eventId, user.moderatorId, user.region as any, ttl);

    this.queryCacheService.invalidateByPrefix(`events:available:${user.region}`);
    this.queryCacheService.invalidateByPrefix(`assignments:active:${user.moderatorId}`);
    this.queryCacheService.invalidate('metrics:summary');
    this.realtimeEventsService.publish({
      type: 'event.claimed',
      region: user.region,
      moderatorId: user.moderatorId,
      eventId,
    });

    return assignment;
  }

  @Post(':eventId/acknowledge')
  async acknowledge(@Param('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    const result = await this.assignmentsService.acknowledgeByEvent(eventId, user.moderatorId);

    this.queryCacheService.invalidateByPrefix(`assignments:active:${user.moderatorId}`);
    this.queryCacheService.invalidate('metrics:summary');
    this.realtimeEventsService.publish({
      type: 'event.acknowledged',
      region: user.region,
      moderatorId: user.moderatorId,
      eventId,
    });

    return result;
  }
}
