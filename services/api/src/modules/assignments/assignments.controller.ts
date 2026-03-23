import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtPayload } from '../../common/auth/jwt.strategy';
import { AssignmentsService } from './assignments.service';
import { QueryCacheService } from '../../shared/query-cache.service';
import { RealtimeEventsService } from '../../shared/realtime-events.service';

const ACTIVE_ASSIGNMENTS_CACHE_TTL_MS = 5_000;

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly queryCacheService: QueryCacheService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  @Post(':assignmentId/acknowledge')
  async acknowledge(@Param('assignmentId') assignmentId: string, @CurrentUser() user: JwtPayload) {
    const assignment = await this.assignmentsService.acknowledge(assignmentId, user.moderatorId);

    this.queryCacheService.invalidateByPrefix(`assignments:active:${user.moderatorId}`);
    this.queryCacheService.invalidate('metrics:summary');
    this.realtimeEventsService.publish({
      type: 'assignment.acknowledged',
      moderatorId: user.moderatorId,
      eventId: assignment.eventId,
    });

    return assignment;
  }

  @Get('me/active')
  active(@CurrentUser() user: JwtPayload) {
    return this.queryCacheService.getOrSet(
      `assignments:active:${user.moderatorId}`,
      () => this.assignmentsService.getActiveByModerator(user.moderatorId),
      ACTIVE_ASSIGNMENTS_CACHE_TTL_MS,
    );
  }
}
