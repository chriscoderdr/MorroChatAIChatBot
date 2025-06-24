import { Module } from '@nestjs/common';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';
import { LlmModule } from 'src/llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [ChatService],
  controllers: [ChatController]
})
export class AgentModule {}
