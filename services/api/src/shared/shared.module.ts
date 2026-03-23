import { Global, Module } from '@nestjs/common';
import { QueryCacheService } from './query-cache.service';
import { RealtimeEventsService } from './realtime-events.service';

@Global()
@Module({
  providers: [QueryCacheService, RealtimeEventsService],
  exports: [QueryCacheService, RealtimeEventsService],
})
export class SharedModule {}