import { registerEnumType } from '@nestjs/graphql';

export enum EventStatus {
  AVAILABLE = 'AVAILABLE',
  CLAIMED = 'CLAIMED',
}

registerEnumType(EventStatus, { name: 'EventStatus' });
