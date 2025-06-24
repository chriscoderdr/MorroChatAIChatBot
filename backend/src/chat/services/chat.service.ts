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
  private defaultTopic: string;

  constructor(
    private readonly langChainService: LangChainService, 
    private readonly chatSessionRepository: ChatSessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.defaultTopic = this.configService.get<string>('CHAT_DEFAULT_TOPIC') || 'Dominican Food';
  }

  async createSession(userId: string): Promise<string> {
    const sessionId = uuidv4();
    await this.chatSessionRepository.createSession(sessionId, userId, this.defaultTopic);
    return sessionId;
  }

  async getOrCreateSession(sessionId: string | null, userId: string): Promise<string> {
    if (!sessionId) {
      return this.createSession(userId);
    }
    
    const session = await this.chatSessionRepository.findBySessionId(sessionId);
    if (!session) {
      return this.createSession(userId);
    }
    
    return sessionId;
  }

  async invoke(userMessage: string, sessionId: string | null, userId: string): Promise<string> {
    try {
      // Get or create session
      const validSessionId = await this.getOrCreateSession(sessionId, userId);
      
      // Save user message to session history
      await this.chatSessionRepository.addMessage(validSessionId, {
        message: userMessage,
        role: 'user',
        timestamp: new Date(),
      });

      // Get session data
      const session = await this.chatSessionRepository.findBySessionId(validSessionId);
      if (!session) {
        throw new NotFoundException(`Session with id ${validSessionId} not found`);
      }

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

      // Save AI response to session history
      await this.chatSessionRepository.addMessage(validSessionId, {
        message: finalResponseContent,
        role: 'ai',
        timestamp: new Date(),
      });

      return finalResponseContent;
    } catch (error) {
      this.logger.error(`Error in chat service: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.chatSessionRepository.getSessionHistory(sessionId);
  }
}
