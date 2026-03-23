import { Controller, Get } from '@nestjs/common';
import { AssignmentsService } from '../assignments/assignments.service';
import { QueryCacheService } from '../../shared/query-cache.service';

const METRICS_CACHE_TTL_MS = 3_000;

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly queryCacheService: QueryCacheService,
  ) {}

  @Get()
  getMetrics() {
    return this.queryCacheService.getOrSet(
      'metrics:summary',
      () => this.assignmentsService.getMetrics(),
      METRICS_CACHE_TTL_MS,
    );
  }
}
