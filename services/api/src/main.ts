import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { EventsService } from './modules/events/events.service';

async function createPartialUniqueIndex(dataSource: DataSource) {
  try {
    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_assignments_event_active
        ON assignments ("eventId")
        WHERE status = 'ACTIVE'
    `);
  } catch (error: any) {
    const code = String(error?.code ?? error?.driverError?.code ?? '');
    if (code !== '42P07' && code !== '23505') {
      throw error;
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const dataSource = app.get(DataSource);
  await createPartialUniqueIndex(dataSource);

  const eventsService = app.get(EventsService);
  await eventsService.seedEventsFromFile();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
