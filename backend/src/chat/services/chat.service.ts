import { Injectable, Logger } from '@nestjs/common';
import { LangChainService } from './langchain.service';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { StoredMongoMessage } from '../schemas/chat-session.schema';
import { BaseMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { withSessionMutex } from './session-mutex';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly defaultTopic: string | undefined;

  constructor(
    private readonly langChainService: LangChainService,
    private readonly chatSessionRepository: ChatSessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.defaultTopic = this.configService.get<string>('CHAT_DEFAULT_TOPIC');
  }

  async getOrCreateSession(userId: string): Promise<string> {
    const session = await this.chatSessionRepository.findByUserId(userId);
    if (!session) {
      await this.chatSessionRepository.createSession(userId, this.defaultTopic);
      this.logger.log(JSON.stringify({ event: 'new_session', userId }));
    }
    return userId;
  }

  async invoke(userMessage: string, userId: string): Promise<string> {
    try {
      const agentWithHistory = await this.langChainService.createLangChainApp(this.defaultTopic);
      
      const result = await agentWithHistory.invoke(
        {
          input: userMessage,
          chat_history: [], // History is pulled automatically by the runnable
        },
        {
          configurable: {
            sessionId: userId,
          },
        }
      );

      let finalResponseContent: string;

      // FIXED: Handle both possible return types from the new chain.
      if (typeof result === 'string') {
        // This is the refusal message from the topic guard
        finalResponseContent = result;
      } else if (result && typeof (result as any).output === 'string') {
        // This is the successful output from the AgentExecutor
        finalResponseContent = (result as any).output;
      } else {
        this.logger.error(JSON.stringify({
          level: 'error',
          event: 'agent_unexpected_structure',
          userId,
          userMessage,
          result
        }));
        finalResponseContent = "Sorry, I encountered an unexpected error.";
      }
      // Log only the user question and answer for chat conversations
      this.logger.log(JSON.stringify({
        event: 'chat',
        userId,
        question: userMessage,
        answer: finalResponseContent
      }));
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
    return withSessionMutex(userId, async () => {
      await this.getOrCreateSession(userId);
      const reply = await this.invoke(userMessage, userId);
      return { reply };
    });
  }
}