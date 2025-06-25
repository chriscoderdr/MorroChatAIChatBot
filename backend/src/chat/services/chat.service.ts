import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIMessage, AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { ChatMessage } from '../interfaces/chat-session.interface';
import { LangChainService } from './langchain.service';
import { v4 as uuidv4 } from 'uuid';
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
    
    // Set up periodic debug logging
    setInterval(() => this.logSessionStats(), 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Log session statistics for debugging
   */
  private async logSessionStats(): Promise<void> {
    try {
      // This method helps ensure sessions are being persisted correctly
      const totalSessions = await this.chatSessionRepository.countSessions();
      this.logger.log(`Current session stats: ${totalSessions} total sessions in database`);
    } catch (error) {
      this.logger.error(`Error logging session stats: ${error.message}`);
    }
  }
  
  /**
   * Force persistence of any pending session data to the database
   * This can be called by maintenance endpoints or scheduled tasks
   */
  async forcePersistSessions(): Promise<{ success: boolean; message: string }> {
    try {
      await this.chatSessionRepository.flushAllPendingMessages();
      return { success: true, message: 'All pending session data has been persisted to the database' };
    } catch (error) {
      this.logger.error(`Error persisting sessions: ${error.message}`, error.stack);
      return { success: false, message: `Error persisting sessions: ${error.message}` };
    }
  }


  // Always use userId as sessionId
  async createSession(userId: string): Promise<string> {
    await this.chatSessionRepository.createSession(userId, this.defaultTopic);
    return userId;
  }

  async getOrCreateSession(sessionId: string | null, userId: string): Promise<string> {
    // Always use userId as sessionId
    const session = await this.chatSessionRepository.findByUserId(userId);
    if (!session) {
      await this.createSession(userId);
    }
    return userId;
  }

  async invoke(userMessage: string, sessionId: string, userId: string): Promise<string> {
    try {
      // Always use userId as sessionId
      const validSessionId = userId;

      // Create user message with proper typing
      const userMessageObj: ChatMessage = {
        message: userMessage,
        role: 'user',
        timestamp: new Date(),
      };

      // Get session data - this will use cache if available
      const session = await this.chatSessionRepository.findByUserId(validSessionId);
      if (!session) {
        throw new NotFoundException(`Session with id ${validSessionId} not found`);
      }

      // Add message to session - this updates the cache immediately
      await this.chatSessionRepository.addMessage(validSessionId, userMessageObj);

      // Initialize LangChain with session topic
      const langChainApp = await this.langChainService.createLangChainApp(session.topic);

      // Convert history messages to LangChain format
      const historyMessages: Array<HumanMessage | AIMessage> = [];

      // Add previous messages as context (limit to last 10 messages to avoid token limits)
      const recentMessages = session.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          historyMessages.push(new HumanMessage(msg.message));
        } else if (msg.role === 'ai') {
          historyMessages.push(new AIMessage(msg.message));
        }
        // Skip 'system' messages as they're handled by the LangChain setup
      }

      // Add the current user message
      historyMessages.push(new HumanMessage(userMessage));

      const inputs = {
        messages: historyMessages
      };

      let finalResponseContent: string = "";
      for await (const output of await langChainApp.stream(inputs)) {
        this.logger.debug(`LangChain output chunk: ${JSON.stringify(output)}`);

        if (output?.agent?.messages) {
          finalResponseContent += (output.agent.messages[0] as AIMessageChunk).text;
        } else if (output?.first_agent?.messages) {
          finalResponseContent += (output.first_agent.messages[0] as AIMessageChunk).content;
        }
      }

      // Create AI response with proper typing
      const aiMessageObj: ChatMessage = {
        message: finalResponseContent,
        role: 'ai',
        timestamp: new Date(),
      };

      // Save AI response to session history (this uses caching)
      await this.chatSessionRepository.addMessage(validSessionId, aiMessageObj);
      console.log(`AI response saved to session ${validSessionId}`);

      return finalResponseContent;
    } catch (error) {
      this.logger.error(`Error in chat service: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.chatSessionRepository.getSessionHistory(sessionId);
  }
  
  /**
   * Get session history using userId instead of sessionId
   * This supports the simplified browser-session only approach
   */
  async getSessionHistoryByUserId(userId: string): Promise<ChatMessage[]> {
    // Get the latest session for this user
    const session = await this.chatSessionRepository.findLatestSessionByUserId(userId);
    
    if (!session) {
      return []; // No session found for this user
    }
    
    return session.messages || [];
  }

  /**
   * Process a chat request with automatic session handling
   * This is the simplified API for frontend use
   */
  async processChat(userMessage: string, sessionId: string | null | undefined, userId: string): Promise<{ reply: string }> {
    // Get or create session (handle undefined as null for backward compatibility)
    const validSessionId = await this.getOrCreateSession(sessionId || null, userId);
    
    // Process the message
    const reply = await this.invoke(userMessage, validSessionId, userId);

    // Return just the reply - no need to expose sessionId
    return { reply };
  }
}
