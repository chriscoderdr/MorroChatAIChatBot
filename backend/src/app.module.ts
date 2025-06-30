import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/config.module';
import { BrowserSessionMiddleware } from './common/middlewares/browser-session.middleware';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = configService.get<number>('throttle.ttl');
        const limit = configService.get<number>('throttle.limit');
        const safeTtl = typeof ttl === 'number' && !isNaN(ttl) ? ttl : 30;
        const safeLimit = typeof limit === 'number' && !isNaN(limit) ? limit : 100;
        return {
          throttlers: [
            {
              ttl: seconds(safeTtl),
              limit: safeLimit,
            }
          ]
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.mongoUri'),
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('MongoDB connection established successfully');
          });
          return connection;
        },
        maxPoolSize: configService.get<number>('database.maxPoolSize'),
        minPoolSize: configService.get<number>('database.minPoolSize'),
        socketTimeoutMS: configService.get<number>('database.socketTimeoutMS'),
        connectTimeoutMS: configService.get<number>('database.connectTimeoutMS'),
        bufferCommands: configService.get<boolean>('database.bufferCommands'),
      }),
    }),
    ChatModule
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService
  ],
})
export class AppModule implements NestModule { 
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BrowserSessionMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
