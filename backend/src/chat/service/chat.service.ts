import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { createLangChainApp } from '../langchain.factory';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  langChainApp: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatSessionRepository: ChatSessionRepository,
    @InjectConnection() private readonly mongoConnection: Connection
  ) {}

  async onModuleInit() {
    this.langChainApp = await createLangChainApp(
      this.configService.get<string>('GEMINI_API_KEY') || "",
      "Dominican Food"
    );
    
    // Check MongoDB connection
    this.checkMongoConnection();
  }
  
  private checkMongoConnection() {
    const state = this.mongoConnection.readyState;
    let status = 'unknown';
    
    switch (state) {
      case 0:
        status = 'disconnected';
        break;
      case 1:
        status = 'connected';
        break;
      case 2:
        status = 'connecting';
        break;
      case 3:
        status = 'disconnecting';
        break;
      default:
        status = `unknown (${state})`;
    }
    
    this.logger.log(`MongoDB connection status: ${status}`);
    
    if (state !== 1) {
      this.logger.warn('MongoDB is not connected. Chat history functionality may be limited.');
    }
  }

  async invoke(userMessage: string, sessionId: string): Promise<string> {
    try {
      // Find or create session
      let session = await this.chatSessionRepository.findBySessionId(sessionId);
      
      if (!session) {
        // Create a new session
        session = await this.chatSessionRepository.createSession(sessionId, sessionId);
      }
      
      // Add user message to history
      const userChatMessage = {
        message: userMessage,
        role: 'user' as const,
        timestamp: new Date()
      };
      
      await this.chatSessionRepository.addMessage(sessionId, userChatMessage);
      
      // Get recent chat history for context (last 10 messages)
      const chatHistory = await this.chatSessionRepository.getSessionHistory(sessionId);
      const recentMessages = chatHistory.slice(-10);
      
      // Convert chat history to LangChain format
      const langchainMessages = recentMessages.map(msg => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.message);
        } else {
          return new AIMessage(msg.message);
        }
      });
      
      // Add current message if it's not already in history
      if (langchainMessages.length === 0 || 
          langchainMessages[langchainMessages.length - 1].content !== userMessage) {
        langchainMessages.push(new HumanMessage(userMessage));
      }
      
      // Get response from language model
      const inputs = {
        messages: langchainMessages
      };
      
      let finalResponseContent = "";
      
      // Process streaming response
      this.logger.debug('Sending request to LangChain');
      for await (const output of await this.langChainApp.stream(inputs)) {
        this.logger.debug(`LangChain output chunk: ${JSON.stringify(output)}`);
        
        if (output?.agent?.messages) {
          finalResponseContent += (output.agent.messages[0] as AIMessageChunk).text;
        } else if (output?.first_agent?.messages) {
          finalResponseContent += (output.first_agent.messages[0] as AIMessageChunk).content;
        }
      }
      
      // Save AI response to the chat history
      const aiChatMessage = {
        message: finalResponseContent,
        role: 'ai' as const,
        timestamp: new Date()
      };
      
      await this.chatSessionRepository.addMessage(sessionId, aiChatMessage);
      
      return finalResponseContent;
    } catch (error) {
      this.logger.error(`Error processing chat message: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async getSessionHistory(sessionId: string) {
    try {
      // Check if a session exists, if not create one
      let session = await this.chatSessionRepository.findBySessionId(sessionId);
      
      if (!session) {
        this.logger.log(`No session found for ID ${sessionId}. Creating a new session.`);
        // Create a new empty session
        session = await this.chatSessionRepository.createSession(sessionId, sessionId);
      }
      
      const messages = await this.chatSessionRepository.getSessionHistory(sessionId);
      
      this.logger.debug(`Retrieved ${messages.length} messages for session ${sessionId}`);
      
      return {
        sessionId,
        messages,
        hasMessages: messages.length > 0
      };
    } catch (error) {
      this.logger.error(`Error retrieving chat history: ${error.message}`, error.stack);
      // Return empty history instead of throwing error
      return {
        sessionId,
        messages: [],
        hasMessages: false,
        error: error.message
      };
    }
  }

}