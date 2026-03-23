import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Assignment } from './modules/assignments/assignment.entity';
import { Event } from './modules/events/event.entity';
import { Moderator } from './modules/moderators/moderator.entity';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ModeratorsModule } from './modules/moderators/moderators.module';
import { JwtStrategy } from './common/auth/jwt.strategy';
import { join } from 'path';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), 'services', 'api', '.env'),
        join(process.cwd(), '..', '.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (typeof databaseUrl === 'string' && databaseUrl.trim().length > 0) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [Moderator, Event, Assignment],
            synchronize: true,
          };
        }

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: Number(configService.get<string>('DB_PORT', '5432')),
          username: configService.get<string>('DB_USER', 'postgres'),
          password: String(configService.get<string>('DB_PASSWORD', 'Post123#')),
          database: configService.get<string>('DB_NAME', 'moderation'),
          entities: [Moderator, Event, Assignment],
          synchronize: true,
        };
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      path: '/graphql',
    }),
    SharedModule,
    ModeratorsModule,
    AuthModule,
    EventsModule,
    AssignmentsModule,
    MetricsModule,
  ],
  providers: [JwtStrategy],
})
export class AppModule {}
