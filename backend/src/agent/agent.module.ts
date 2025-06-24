import { Module } from '@nestjs/common';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';

@Module({
  imports: [],
  providers: [ChatService],
  controllers: [ChatController]
})
export class AgentModule {}
