// chat-session.repository.ts (Corrected)

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession, StoredMongoMessage } from '../schemas/chat-session.schema';
import { SessionCacheService } from '../services/session-cache.service';

@Injectable()
export class ChatSessionRepository {
  private readonly logger = new Logger(ChatSessionRepository.name);

  constructor(
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
    private readonly sessionCacheService: SessionCacheService,
  ) {}

  async findByUserId(userId: string): Promise<ChatSession | null> {
    // Always fetch from MongoDB for latest data
    return await this.chatSessionModel.findOne({ userId }).exec();
  }

  async createSession(userId: string, topic?: string): Promise<ChatSession> {
    const session = new this.chatSessionModel({
      userId,
      topic,
      messages: [],
    });
    const savedSession = await session.save();
    this.sessionCacheService.setSession(userId, savedSession);
    return savedSession;
  }
  
  // NOTE: The addMessage and other background update methods in this repository
  // are now BYPASSED by the new MongoDBChatMessageHistory logic.
  // They can be kept for other potential uses or cleaned up later.
  // The 'getSessionHistory' method below is the one causing the type errors.

  /**
   * Gets the message history for a given session ID (user ID).
   * @param userId The user's session ID.
   * @returns An array of messages in the LangChain StoredMessage format.
   */
  async getSessionHistory(userId: string): Promise<StoredMongoMessage[]> {
    const session = await this.findByUserId(userId);
    return session?.messages ?? [];
  }
}