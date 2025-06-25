import { Document } from 'mongoose';

export interface ChatMessage {
  message: string;
  role: 'user' | 'system' | 'ai';
  timestamp: Date;
}

export interface ChatSession extends Document {
  sessionId: string;
  userId: string;
  topic?: string;
  messages: ChatMessage[];
  // Mongoose timestamp fields (added by { timestamps: true })
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
