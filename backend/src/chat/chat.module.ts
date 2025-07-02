import { Module } from '@nestjs/common';
import { agents } from './agents.providers';
import { MongooseModule } from '@nestjs/mongoose';
import { LangChainService } from './services/langchain.service';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatSessionRepository } from './repositories/chat-session.repository';
import { SessionCacheService } from './services/session-cache.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { ChatUploadController } from './controllers/chat-upload.controller';
import { PdfVectorService } from './services/pdf-vector.service';
import { PdfRetrievalService } from './services/pdf-retrieval.service';
import { ChromaService } from './services/chroma.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
    LlmModule,
  ],
  controllers: [ChatController, ChatUploadController],
  providers: [
    LangChainService,
    ChatSessionRepository,
    SessionCacheService,
    ChatService,
    PdfVectorService,
    PdfRetrievalService,
    ChromaService,
    ...agents,
  ],
  exports: [ChatService],
})
export class ChatModule {}
