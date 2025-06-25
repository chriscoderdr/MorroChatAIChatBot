import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import aiConfig from './ai.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig, databaseConfig, aiConfig],
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class AppConfigModule {}
