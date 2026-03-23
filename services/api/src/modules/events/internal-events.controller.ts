import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryCacheService } from '../../shared/query-cache.service';
import { RealtimeEventsService } from '../../shared/realtime-events.service';

type ExpiredEventPayload = {
  eventId: string;
  region: string;
};

type ExpiredNotificationBody = {
  token?: string;
  expiredEvents?: ExpiredEventPayload[];
};

@Controller('internal/assignments')
export class InternalEventsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly queryCacheService: QueryCacheService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  @Post('expired')
  handleExpiredAssignments(@Body() body: ExpiredNotificationBody) {
    const expectedToken = this.configService.get<string>('INTERNAL_API_TOKEN', 'dev-internal-token');
    if (!body?.token || body.token !== expectedToken) {
      throw new ForbiddenException('Invalid internal token');
    }

    const expiredEvents = Array.isArray(body.expiredEvents) ? body.expiredEvents : [];
    const uniqueRegions = [...new Set(expiredEvents.map((event) => event.region).filter(Boolean))];

    this.queryCacheService.invalidateByPrefix('events:available:');
    this.queryCacheService.invalidateByPrefix('assignments:active:');
    this.queryCacheService.invalidate('metrics:summary');

    if (!expiredEvents.length) {
      this.realtimeEventsService.publish({
        type: 'assignments.expired',
        payload: { count: 0 },
      });

      return { ok: true, invalidated: true, notified: 0 };
    }

    for (const region of uniqueRegions) {
      const regionEventIds = expiredEvents
        .filter((event) => event.region === region)
        .map((event) => event.eventId);

      this.realtimeEventsService.publish({
        type: 'assignments.expired',
        region,
        payload: {
          count: regionEventIds.length,
          eventIds: regionEventIds,
        },
      });
    }

    return {
      ok: true,
      invalidated: true,
      notified: expiredEvents.length,
      regions: uniqueRegions,
    };
  }
}