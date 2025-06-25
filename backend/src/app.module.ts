import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/config.module';
import { BrowserSessionMiddleware } from './common/middlewares/browser-session.middleware';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: seconds(30),
          limit: 100,
        }
      ]
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/morro_chat',
        // Connection pool settings
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('MongoDB connection established successfully');
          });
          return connection;
        },
        // Modern MongoDB connection options (compatible with newer MongoDB drivers)
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        // Enable in-memory caching
        bufferCommands: false,
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
