import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './service/chat.service';
import { ChatController } from './controller/chat.controller';
import { HistoryController } from './controller/history.controller';
import { LangChainService } from './services/langchain.service';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatSessionRepository } from './repositories/chat-session.repository';
import { SessionCacheService } from './services/session-cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
  ],
  controllers: [ChatController, HistoryController],
  providers: [
    ChatService,
    LangChainService,
    ChatSessionRepository,
    SessionCacheService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
