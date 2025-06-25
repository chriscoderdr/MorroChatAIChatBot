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
    
    // Set up a periodic flush of pending messages to database
    setInterval(() => this._flushAllPendingMessages(), 60 * 1000); // Every minute
    
    // Ensure we flush any pending messages before the application exits
    process.on('beforeExit', () => {
      this.logger.log('Process exiting, flushing pending messages to database');
      this._flushAllPendingMessages();
    });
  }
  
  /**
   * Count the total number of sessions in the database
   */
  async countSessions(): Promise<number> {
    try {
      return await this.chatSessionModel.countDocuments().exec();
    } catch (error) {
      this.logger.error(`Error counting sessions: ${error.message}`, error.stack);
      return 0;
    }
  }
  
  /**
   * Public method to flush all pending messages to the database
   */
  async flushAllPendingMessages(): Promise<void> {
    await this._flushAllPendingMessages();
  }
  
  /**
   * Flush all pending messages for all sessions to the database
   */
  private async _flushAllPendingMessages(): Promise<void> {
    try {
      const sessions = this.sessionCacheService.getAllSessionIds();
      
      if (sessions.length === 0) {
        return;
      }
      
      this.logger.log(`Flushing pending messages for ${sessions.length} sessions`);
      
      // Process each session
      for (const sessionId of sessions) {
        const pendingMessages = this.sessionCacheService.getPendingMessages(sessionId);
        
        if (pendingMessages.length > 0) {
          this.logger.log(`Flushing ${pendingMessages.length} messages for session ${sessionId}`);
          await this.updateMessagesInBackground(sessionId);
        }
      }
    } catch (error) {
      this.logger.error(`Error flushing pending messages: ${error.message}`, error.stack);
    }
  }

  async findByUserId(userId: string): Promise<ChatSession | null> {
    // Try to get the session from the cache first
    const cachedSession = this.sessionCacheService.getSession(userId);
    if (cachedSession) {
      return cachedSession;
    }
    // If not in cache, get it from the database
    const session = await this.chatSessionModel.findOne({ userId }).exec();
    // If found, cache it for future use
    if (session) {
      this.sessionCacheService.setSession(userId, session);
    }
    return session;
  }

  async createSession(userId: string, topic?: string): Promise<ChatSession> {
    this.logger.log(`Creating new session: userId=${userId}, topic=${topic}`);
    try {
      const session = new this.chatSessionModel({
        userId,
        topic,
        messages: [],
      });
      // Save to database
      const savedSession = await session.save();
      this.logger.log(`Session for userId ${userId} saved to database: ${savedSession._id}`);
      // Cache the new session
      this.sessionCacheService.setSession(userId, savedSession);
      return savedSession;
    } catch (error) {
      this.logger.error(`Failed to create session for userId ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addMessage(userId: string, message: ChatMessage): Promise<ChatSession | null> {
    try {
      this.logger.log(`Adding message to session for userId ${userId}: ${JSON.stringify(message)}`);
      // Make sure the session exists in the database
      const sessionExists = await this.chatSessionModel.exists({ userId }).exec();
      this.logger.log(`Session for userId ${userId} exists in database: ${!!sessionExists}`);
      if (!sessionExists) {
        // Session doesn't exist in DB, get it from cache and recreate
        const cachedSession = this.sessionCacheService.getSession(userId);
        if (cachedSession) {
          this.logger.log(`Recreating session for userId ${userId} in database from cache`);
          // Create a new document in MongoDB
          const newSession = new this.chatSessionModel({
            userId: cachedSession.userId,
            topic: cachedSession.topic,
            messages: cachedSession.messages,
          });
          await newSession.save();
          this.logger.log(`Successfully recreated session for userId ${userId} in database`);
        } else {
          throw new Error(`Session for userId ${userId} not found in cache or database`);
        }
      }
      // Update the cache immediately for fast reads
      this.sessionCacheService.updateSessionMessages(userId, message);
      // Queue the message to be written to the database
      this.sessionCacheService.addPendingMessage(userId, message);
      // Perform the database update synchronously for the first message to ensure it's saved
      // For subsequent messages, we can perform it asynchronously
      if (this.sessionCacheService.getPendingMessages(userId).length <= 1) {
        // Direct update for the first message to ensure it's saved
        this.logger.log(`Direct database update for first message in session for userId ${userId}`);
        await this.chatSessionModel.updateOne(
          { userId },
          { $push: { messages: message } }
        ).exec();
        // Clear the pending message since we've saved it directly
        this.sessionCacheService.clearPendingMessages(userId);
      } else {
        // Perform the database update asynchronously for subsequent messages
        // This allows the function to return quickly while DB operation happens in background
        this.logger.log(`Queueing background update for session for userId ${userId}`);
        this.updateMessagesInBackground(userId);
      }
      // Return the cached version which includes the new message
      return this.sessionCacheService.getSession(userId);
    } catch (error) {
      this.logger.error(`Failed to add message to session for userId ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  private async updateMessagesInBackground(userId: string): Promise<void> {
    // Get pending messages
    const pendingMessages = this.sessionCacheService.getPendingMessages(userId);
    if (pendingMessages.length === 0) {
      return;
    }
    this.logger.log(`Updating MongoDB with ${pendingMessages.length} pending messages for userId ${userId}`);
    try {
      // Update in database in a batch operation
      const result = await this.chatSessionModel.updateOne(
        { userId },
        { $push: { messages: { $each: pendingMessages } } }
      ).exec();
      this.logger.log(`MongoDB update result: ${JSON.stringify(result)}`);
      if (result.modifiedCount === 0) {
        this.logger.warn(`No document was updated for userId ${userId}. The session might be missing in the database.`);
        // Attempt to retrieve the session
        const session = await this.chatSessionModel.findOne({ userId }).exec();
        if (!session) {
          this.logger.warn(`Session for userId ${userId} not found in database. Recreating from cache.`);
          // Get the cached session
          const cachedSession = this.sessionCacheService.getSession(userId);
          if (cachedSession) {
            // Create a new document in MongoDB
            const newSession = new this.chatSessionModel({
              userId: cachedSession.userId,
              topic: cachedSession.topic,
              messages: cachedSession.messages,
            });
            await newSession.save();
            this.logger.log(`Recreated session for userId ${userId} in database.`);
          }
        }
      } else {
        // Clear pending messages after successful update
        this.sessionCacheService.clearPendingMessages(userId);
        this.logger.log(`Successfully updated MongoDB and cleared pending messages for userId ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Background update for userId ${userId} failed: ${error.message}`, error.stack);
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
      this.sessionCacheService.setSession(session.userId, session);
    }
    
    return session;
  }
}
