import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { LangChainService } from './services/langchain.service';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatSessionRepository } from './repositories/chat-session.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    LangChainService,
    ChatSessionRepository,
  ],
  exports: [ChatService],
})
export class ChatModule {}
