import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { EventStatus } from '../../common/enums/event-status.enum';
import { Region } from '../../common/enums/region.enum';

describe('EventsService', () => {
  it('throws when an event is not available for claim', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([]),
    };

    const dataSource = {
      transaction: jest.fn((callback: (manager: any) => Promise<unknown>) => callback(manager)),
    };

    const service = new EventsService({} as any, dataSource as any);

    await expect(service.claimEvent('event-1', 'mod-1', Region.ASIA, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('creates an assignment after locking an available event', async () => {
    const assignment = {
      id: 'assignment-1',
      eventId: 'event-1',
      moderatorId: 'mod-1',
      status: AssignmentStatus.ACTIVE,
    };

    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'event-1' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([assignment]),
    };

    const dataSource = {
      transaction: jest.fn((callback: (manager: any) => Promise<unknown>) => callback(manager)),
    };

    const service = new EventsService({} as any, dataSource as any);
    const result = await service.claimEvent('event-1', 'mod-1', Region.ASIA, 1);

    expect(result).toEqual(assignment);
    expect(manager.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE events'),
      [EventStatus.CLAIMED, 'event-1'],
    );
  });
});