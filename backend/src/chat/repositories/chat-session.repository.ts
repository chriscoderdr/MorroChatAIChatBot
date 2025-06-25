import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from '../schemas/chat-session.schema';
import { ChatMessage } from '../interfaces/chat-session.interface';
import { SessionCacheService } from '../services/session-cache.service';

@Injectable()
export class ChatSessionRepository {
  private readonly logger = new Logger(ChatSessionRepository.name);

  constructor(
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
    private readonly sessionCacheService: SessionCacheService,
  ) {
    // Set up a periodic cache cleanup task
    setInterval(() => this.sessionCacheService.cleanupExpiredEntries(), 30 * 60 * 1000); // Every 30 minutes
  }

  async findBySessionId(sessionId: string): Promise<ChatSession | null> {
    // Try to get the session from the cache first
    const cachedSession = this.sessionCacheService.getSession(sessionId);
    if (cachedSession) {
      return cachedSession;
    }
    
    // If not in cache, get it from the database
    const session = await this.chatSessionModel.findOne({ sessionId }).exec();
    
    // If found, cache it for future use
    if (session) {
      this.sessionCacheService.setSession(sessionId, session);
    }
    
    return session;
  }

  async createSession(sessionId: string, userId: string, topic?: string): Promise<ChatSession> {
    const session = new this.chatSessionModel({
      sessionId,
      userId,
      topic,
      messages: [],
    });
    
    // Save to database
    const savedSession = await session.save();
    
    // Cache the new session
    this.sessionCacheService.setSession(sessionId, savedSession);
    
    return savedSession;
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<ChatSession | null> {
    try {
      // Update the cache immediately for fast reads
      this.sessionCacheService.updateSessionMessages(sessionId, message);
      
      // Queue the message to be written to the database
      this.sessionCacheService.addPendingMessage(sessionId, message);
      
      // Perform the database update asynchronously
      // This allows the function to return quickly while DB operation happens in background
      this.updateMessagesInBackground(sessionId);
      
      // Return the cached version which includes the new message
      return this.sessionCacheService.getSession(sessionId);
    } catch (error) {
      this.logger.error(`Failed to add message to session ${sessionId}`, error.stack);
      throw error;
    }
  }
  
  private async updateMessagesInBackground(sessionId: string): Promise<void> {
    // Get pending messages
    const pendingMessages = this.sessionCacheService.getPendingMessages(sessionId);
    
    if (pendingMessages.length === 0) {
      return;
    }
    
    try {
      // Update in database in a batch operation
      await this.chatSessionModel.updateOne(
        { sessionId },
        { $push: { messages: { $each: pendingMessages } } }
      ).exec();
      
      // Clear pending messages after successful update
      this.sessionCacheService.clearPendingMessages(sessionId);
    } catch (error) {
      this.logger.error(`Background update for session ${sessionId} failed`, error.stack);
      // We don't throw here since it's a background operation
      // Failed updates will be retried on next message
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    // Try to get from cache first
    const cachedSession = this.sessionCacheService.getSession(sessionId);
    if (cachedSession) {
      return cachedSession.messages || [];
    }
    
    // Fall back to database if not in cache
    const session = await this.chatSessionModel.findOne({ sessionId }).exec();
    
    // Cache the session if found
    if (session) {
      this.sessionCacheService.setSession(sessionId, session);
    }
    
    return session?.messages || [];
  }

  /**
   * Find the most recent session for a given userId
   */
  async findLatestSessionByUserId(userId: string): Promise<ChatSession | null> {
    // First check if there are any sessions for this user in the cache
    const cachedSessions = this.sessionCacheService.getSessionsByUserId(userId);
    if (cachedSessions && cachedSessions.length > 0) {
      // Sort by updatedAt using type-safe access
      return cachedSessions.sort((a, b) => {
        // Use type assertion since we know these fields exist at runtime thanks to Mongoose
        const bDate = (b as any).updatedAt || new Date(0);
        const aDate = (a as any).updatedAt || new Date(0);
        return bDate.getTime() - aDate.getTime();
      })[0];
    }
    
    // If not in cache, query the database
    const session = await this.chatSessionModel
      .findOne({ userId })
      .sort({ updatedAt: -1 })
      .exec();
    
    // Cache the session if found
    if (session) {
      this.sessionCacheService.setSession(session.sessionId, session);
    }
    
    return session;
  }
}
