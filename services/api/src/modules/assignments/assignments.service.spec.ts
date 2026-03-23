import { NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';

describe('AssignmentsService', () => {
  it('returns aggregate metrics', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    };

    const repository = {
      count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(3),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const service = new AssignmentsService(repository as any, {} as any);

    await expect(service.getMetrics()).resolves.toEqual({
      totalAssigned: 10,
      active: 2,
      expired: 3,
    });
  });

  it('throws when acknowledging an event without an active assignment', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([]),
    };

    const dataSource = {
      transaction: jest.fn((callback: (manager: any) => Promise<unknown>) => callback(manager)),
    };

    const service = new AssignmentsService({} as any, dataSource as any);

    await expect(service.acknowledgeByEvent('event-1', 'mod-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('acknowledges an active assignment by event', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([{ id: 'assignment-1' }]).mockResolvedValueOnce(undefined),
    };

    const dataSource = {
      transaction: jest.fn((callback: (manager: any) => Promise<unknown>) => callback(manager)),
    };

    const service = new AssignmentsService({} as any, dataSource as any);

    await expect(service.acknowledgeByEvent('event-1', 'mod-1')).resolves.toBe(true);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assignments'),
      [AssignmentStatus.ACKNOWLEDGED, 'event-1', 'mod-1', AssignmentStatus.ACTIVE],
    );
  });
});