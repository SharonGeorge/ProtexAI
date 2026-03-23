import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from './event.entity';
import { Region } from '../../common/enums/region.enum';
import { Assignment } from '../assignments/assignment.entity';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { EventStatus } from '../../common/enums/event-status.enum';

type SeedEventInput = { title: string; region: Region; payload: Record<string, unknown> };

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  async getAvailableEvents(region: Region): Promise<Event[]> {
    return this.eventRepository
      .createQueryBuilder('event')
      .where('event.region = :region', { region })
      .andWhere('event.status = :availableStatus', { availableStatus: EventStatus.AVAILABLE })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM assignments assignment
          WHERE assignment."eventId" = event.id
            AND assignment.status = :activeStatus
            AND assignment."expiresAt" > NOW()
        )`,
        { activeStatus: AssignmentStatus.ACTIVE },
      )
      .orderBy('event.createdAt', 'ASC')
      .getMany();
  }

  async claimEvent(eventId: string, moderatorId: string, region: Region, ttlMinutes: number): Promise<Assignment> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.query(
        `
        SELECT e.id
        FROM events e
        WHERE e.id = $2
          AND e.region = $3
          AND e.status = $4
          AND NOT EXISTS (
            SELECT 1
            FROM assignments a
            WHERE a."eventId" = e.id
              AND a.status = $1
              AND a."expiresAt" > NOW()
          )
        FOR UPDATE SKIP LOCKED
        `,
        [AssignmentStatus.ACTIVE, eventId, region, EventStatus.AVAILABLE],
      );

      if (!locked?.length) {
        throw new NotFoundException('Event is not available for claim in your region');
      }

      await manager.query(
        `
        UPDATE events
        SET status = $1
        WHERE id = $2
        `,
        [EventStatus.CLAIMED, eventId],
      );

      const assignmentResult = await manager.query(
        `
        INSERT INTO assignments ("eventId", "moderatorId", status, "expiresAt")
        VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)
        RETURNING *
        `,
        [eventId, moderatorId, AssignmentStatus.ACTIVE, ttlMinutes],
      );

      return assignmentResult[0] as Assignment;
    });
  }

  async seedEventsFromFile(): Promise<void> {
    const count = await this.eventRepository.count();
    if (count > 0) {
      return;
    }

    const parsed = await this.readSeedEventsFromFile();
    await this.insertSeedEvents(parsed);
  }

  async reseedEventsFromFile(): Promise<{ inserted: number }> {
    const parsed = await this.readSeedEventsFromFile();
    const inserted = await this.insertSeedEvents(parsed);
    return { inserted };
  }

  private async readSeedEventsFromFile(): Promise<SeedEventInput[]> {

    const candidates = [
      join(process.cwd(), 'data', 'events.json'),
      join(process.cwd(), '..', '..', 'data', 'events.json'),
    ];
    const filePath = candidates.find((candidate) => existsSync(candidate));
    if (!filePath) {
      return [];
    }

    const file = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(file) as SeedEventInput[];

    return parsed;
  }

  private async insertSeedEvents(parsed: SeedEventInput[]): Promise<number> {
    if (!parsed.length) {
      return 0;
    }

    const records = parsed.map((item) =>
      this.eventRepository.create({
        title: item.title,
        region: item.region,
        status: EventStatus.AVAILABLE,
        payload: item.payload,
      }),
    );

    await this.eventRepository.save(records);

    return records.length;
  }
}
