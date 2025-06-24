import { Module } from '@nestjs/common';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';

@Module({
  providers: [ChatService],
  controllers: [ChatController]
})
export class AgentModule {}
