import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from '../schemas/chat-session.schema';
import { ChatMessage } from '../interfaces/chat-session.interface';

@Injectable()
export class ChatSessionRepository {
  private readonly logger = new Logger(ChatSessionRepository.name);

  constructor(
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {}

  async findBySessionId(sessionId: string): Promise<ChatSession | null> {
    return this.chatSessionModel.findOne({ sessionId }).exec();
  }

  async createSession(sessionId: string, userId: string, topic?: string): Promise<ChatSession> {
    const session = new this.chatSessionModel({
      sessionId,
      userId,
      topic,
      messages: [],
    });
    return session.save();
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<ChatSession | null> {
    try {
      return await this.chatSessionModel.findOneAndUpdate(
        { sessionId },
        { $push: { messages: message } },
        { new: true },
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to add message to session ${sessionId}`, error.stack);
      throw error;
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = await this.chatSessionModel.findOne({ sessionId }).exec();
    return session?.messages || [];
  }
}
