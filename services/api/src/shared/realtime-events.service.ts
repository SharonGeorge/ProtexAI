import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, concat, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export type RealtimeEvent = {
  type: string;
  region?: string;
  moderatorId?: string;
  eventId?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class RealtimeEventsService {
  private readonly subject = new Subject<RealtimeEvent>();

  publish(event: Omit<RealtimeEvent, 'timestamp'>): void {
    this.subject.next({ ...event, timestamp: new Date().toISOString() });
  }

  streamForRegion(region: string): Observable<MessageEvent> {
    return concat(
      of({
        data: {
          type: 'stream.connected',
          region,
          timestamp: new Date().toISOString(),
        },
      } satisfies MessageEvent),
      this.subject.pipe(
        filter((event) => !event.region || event.region === region),
        map((event) => ({ data: event } satisfies MessageEvent)),
      ),
    );
  }
}