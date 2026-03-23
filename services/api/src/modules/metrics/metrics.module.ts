import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [AssignmentsModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
