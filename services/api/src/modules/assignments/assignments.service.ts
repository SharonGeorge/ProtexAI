import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Assignment } from './assignment.entity';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { EventStatus } from '../../common/enums/event-status.enum';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    private readonly dataSource: DataSource,
  ) {}

  async acknowledge(assignmentId: string, moderatorId: string): Promise<Assignment> {
    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.query(
        `
        UPDATE assignments
        SET status = $1,
            "acknowledgedAt" = NOW()
        WHERE id = $2
          AND "moderatorId" = $3
          AND status = $4
          AND "expiresAt" > NOW()
        RETURNING *
        `,
        [AssignmentStatus.ACKNOWLEDGED, assignmentId, moderatorId, AssignmentStatus.ACTIVE],
      );

      if (!updated?.length) {
        throw new NotFoundException('Assignment not found or already expired/acknowledged');
      }

      return updated[0] as Assignment;
    });
  }

  async getActiveByModerator(moderatorId: string): Promise<Assignment[]> {
    return this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.moderatorId = :moderatorId', { moderatorId })
      .andWhere('assignment.status = :status', { status: AssignmentStatus.ACTIVE })
      .andWhere('assignment.expiresAt > NOW()')
      .orderBy('assignment.claimedAt', 'DESC')
      .getMany();
  }

  async acknowledgeByEvent(eventId: string, moderatorId: string): Promise<boolean> {
    const acknowledged = await this.dataSource.transaction(async (manager) => {
      const updated = await manager.query(
        `
        UPDATE assignments
        SET status = $1,
            "acknowledgedAt" = NOW()
        WHERE id = (
          SELECT id
          FROM assignments
          WHERE "eventId" = $2
            AND "moderatorId" = $3
            AND status = $4
            AND "expiresAt" > NOW()
          ORDER BY "claimedAt" DESC
          LIMIT 1
        )
        RETURNING id
        `,
        [AssignmentStatus.ACKNOWLEDGED, eventId, moderatorId, AssignmentStatus.ACTIVE],
      );

      if (!updated?.length) {
        throw new NotFoundException('Active assignment not found for this event');
      }

      await manager.query(
        `
        UPDATE events
        SET status = $1
        WHERE id = $2
        `,
        [EventStatus.CLAIMED, eventId],
      );

      return true;
    });

    return acknowledged;
  }

  async getMetrics(): Promise<{ totalAssigned: number; active: number; expired: number }> {
    const [totalAssigned, expired] = await Promise.all([
      this.assignmentRepository.count(),
      this.assignmentRepository.count({ where: { status: AssignmentStatus.EXPIRED } }),
    ]);

    const active = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.status = :status', { status: AssignmentStatus.ACTIVE })
      .andWhere('assignment.expiresAt > NOW()')
      .getCount();

    return { totalAssigned, active, expired };
  }
}
