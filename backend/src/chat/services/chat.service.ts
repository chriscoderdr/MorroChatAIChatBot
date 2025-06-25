import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatMessage } from '../interfaces/chat-session.interface';
import { LangChainService } from './langchain.service';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private defaultTopic: string | undefined;

  constructor(
    private readonly langChainService: LangChainService, 
    private readonly chatSessionRepository: ChatSessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.defaultTopic = this.configService.get<string>('CHAT_DEFAULT_TOPIC') || undefined;
    
    setInterval(() => this.logSessionStats(), 5 * 60 * 1000);
  }
  
  private async logSessionStats(): Promise<void> {
    try {
      const totalSessions = await this.chatSessionRepository.countSessions();
      this.logger.log(`Current session stats: ${totalSessions} total sessions in database`);
    } catch (error) {
      this.logger.error(`Error logging session stats: ${error.message}`);
    }
  }
  
  async forcePersistSessions(): Promise<{ success: boolean; message: string }> {
    try {
      await this.chatSessionRepository.flushAllPendingMessages();
      return { success: true, message: 'All pending session data has been persisted to the database' };
    } catch (error) {
      this.logger.error(`Error persisting sessions: ${error.message}`, error.stack);
      return { success: false, message: `Error persisting sessions: ${error.message}` };
    }
  }


  async createSession(userId: string): Promise<string> {
    await this.chatSessionRepository.createSession(userId, this.defaultTopic);
    return userId;
  }

  async getOrCreateSession(sessionId: string | null, userId: string): Promise<string> {
    const session = await this.chatSessionRepository.findByUserId(userId);
    if (!session) {
      await this.createSession(userId);
    }
    return userId;
  }

  async invoke(userMessage: string, sessionId: string, userId: string): Promise<string> {
    try {
      const validSessionId = userId;

      const userMessageObj: ChatMessage = {
        message: userMessage,
        role: 'user',
        timestamp: new Date(),
      };

      const session = await this.chatSessionRepository.findByUserId(validSessionId);
      if (!session) {
        throw new NotFoundException(`Session with id ${validSessionId} not found`);
      }

      await this.chatSessionRepository.addMessage(validSessionId, userMessageObj);

      const langChainApp = await this.langChainService.createLangChainApp(session.topic);

      const historyMessages: Array<HumanMessage | AIMessage> = [];
      const recentMessages = session.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          historyMessages.push(new HumanMessage(msg.message));
        } else if (msg.role === 'ai') {
          historyMessages.push(new AIMessage(msg.message));
        }
      }

      const inputs = {
        messages: historyMessages,
        originalQuery: userMessage,
      };

      let finalResponseContent: string = "";
      
      // FIXED: The streaming loop is now smarter about what content it appends.
      for await (const output of await langChainApp.stream(inputs)) {
        this.logger.debug(`LangChain output chunk: ${JSON.stringify(output)}`);

        // Only process the final answer from the 'agent' node.
        if (output.agent && output.agent.messages?.[0]) {
          const agentMessage = output.agent.messages[0] as AIMessageChunk;

          // Ensure the chunk content is a string and not a tool call object before appending.
          if (typeof agentMessage.content === 'string' && (!agentMessage.tool_call_chunks || agentMessage.tool_call_chunks.length === 0)) {
            finalResponseContent += agentMessage.content;
          }
        }
      }

      const aiMessageObj: ChatMessage = {
        message: finalResponseContent,
        role: 'ai',
        timestamp: new Date(),
      };

      await this.chatSessionRepository.addMessage(validSessionId, aiMessageObj);
      this.logger.log(`AI response saved to session ${validSessionId}`);

      return finalResponseContent;
    } catch (error) {
      this.logger.error(`Error in chat service: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.chatSessionRepository.getSessionHistory(sessionId);
  }
  
  async getSessionHistoryByUserId(userId: string): Promise<ChatMessage[]> {
    const session = await this.chatSessionRepository.findLatestSessionByUserId(userId);
    
    if (!session) {
      return [];
    }
    
    return session.messages || [];
  }

  async processChat(userMessage: string, sessionId: string | null | undefined, userId: string): Promise<{ reply: string }> {
    const validSessionId = await this.getOrCreateSession(sessionId || null, userId);
    const reply = await this.invoke(userMessage, validSessionId, userId);
    return { reply };
  }
}