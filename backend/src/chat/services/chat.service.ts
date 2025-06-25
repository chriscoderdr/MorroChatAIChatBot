import { Injectable, Logger } from '@nestjs/common';
import { LangChainService } from './langchain.service';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { StoredMongoMessage } from '../schemas/chat-session.schema';
import { BaseMessage } from '@langchain/core/messages';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly langChainService: LangChainService,
    private readonly chatSessionRepository: ChatSessionRepository,
  ) {}

  async getOrCreateSession(userId: string): Promise<string> {
    const session = await this.chatSessionRepository.findByUserId(userId);
    if (!session) {
      await this.chatSessionRepository.createSession(userId);
    }
    return userId;
  }

  async invoke(userMessage: string, userId: string): Promise<string> {
    try {
      const agentWithHistory = await this.langChainService.createLangChainApp();
      
      // FIXED: The input object must match the expected type, including chat_history.
      // We can pass an empty array here, as the RunnableWithMessageHistory will
      // overwrite it with the real history from the database.
      const result = await agentWithHistory.invoke(
        {
          input: userMessage,
          chat_history: [] as BaseMessage[],
        },
        {
          configurable: {
            sessionId: userId,
          },
        }
      );

      const finalResponseContent = (result as any).output;
      
      if (typeof finalResponseContent !== 'string') {
        this.logger.error("Agent did not return a string output.", result);
        return "Sorry, I encountered an unexpected error.";
      }

      this.logger.log(`AI response for session ${userId} handled successfully.`);
      return finalResponseContent;

    } catch (error) {
      this.logger.error(`Error in chat service invoke: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSessionHistory(userId: string): Promise<StoredMongoMessage[]> {
    return this.chatSessionRepository.getSessionHistory(userId);
  }

  async processChat(userMessage: string, userId: string): Promise<{ reply: string }> {
    await this.getOrCreateSession(userId);
    const reply = await this.invoke(userMessage, userId);
    return { reply };
  }
}