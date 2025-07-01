import { Injectable, Logger } from '@nestjs/common';
import { LangChainService } from './langchain.service';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { StoredMongoMessage } from '../schemas/chat-session.schema';
import { BaseMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { withSessionMutex } from './session-mutex';
import { MongoDBChatMessageHistory } from './mongodb.chat.message.history';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from '../schemas/chat-session.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly defaultTopic: string | undefined;

  constructor(
    private readonly langChainService: LangChainService,
    private readonly chatSessionRepository: ChatSessionRepository,
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
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
      
      // Ensure the session exists before invoking the agent
      await this.getOrCreateSession(userId);
      
      // Debug message history count before invoking
      const mongoHistory = new MongoDBChatMessageHistory(this.chatSessionModel, userId);
      await mongoHistory.debugMessageCount();
      
      // Explicitly identify which session ID to use for message history
      const result = await agentWithHistory.invoke(
        {
          input: userMessage,
          // Empty array here - history will be fetched from MongoDB by the RunnableWithMessageHistory
          chat_history: [], 
        },
        {
          // Both of these are needed - configurable for most tools and metadata for some specific tools
          configurable: {
            sessionId: userId,
          },
          // Add metadata for agent registry tools
          metadata: {
            sessionId: userId,
          }
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

  async addDocumentContext(userId: string, documentInfo: string): Promise<void> {
    try {
      // Add document upload context to MongoDB chat history
      const mongoHistory = new MongoDBChatMessageHistory(this.chatSessionModel, userId);
      
      // Add a system message indicating document upload
      const { HumanMessage } = await import('@langchain/core/messages');
      await mongoHistory.addMessage(new HumanMessage(documentInfo));
      
      this.logger.log(`Added document context for user ${userId}: ${documentInfo}`);
    } catch (error) {
      this.logger.error(`Error adding document context: ${error.message}`, error.stack);
    }
  }

  async processChat(userMessage: string, userId: string): Promise<{ reply: string }> {
    console.log(`=== CHAT SERVICE: Processing message "${userMessage}" for user ${userId} ===`);
    return withSessionMutex(userId, async () => {
      await this.getOrCreateSession(userId);
      const reply = await this.invoke(userMessage, userId);
      return { reply };
    });
  }
}