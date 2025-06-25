import { Document } from 'mongoose';

export interface ChatMessage {
  message: string;
  role: 'user' | 'system' | 'ai';
  timestamp: Date;
}

export interface ChatSession extends Document {
  userId: string; // This is the browserSessionId and the unique identifier
  topic?: string;
  messages: ChatMessage[];
  // Mongoose timestamp fields (added by { timestamps: true })
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
