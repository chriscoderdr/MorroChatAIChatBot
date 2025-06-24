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
  createdAt: Date;
  updatedAt: Date;
}
