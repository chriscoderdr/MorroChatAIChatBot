import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LangChainService } from './services/langchain.service';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatSessionRepository } from './repositories/chat-session.repository';
import { SessionCacheService } from './services/session-cache.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [
    LangChainService,
    ChatSessionRepository,
    SessionCacheService,
    ChatService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
