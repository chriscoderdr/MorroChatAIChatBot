import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChatMessage } from '../interfaces/chat-session.interface';

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  topic?: string;

  @Prop([{
    message: { type: String, required: true },
    role: { type: String, enum: ['user', 'system', 'ai'], required: true },
    timestamp: { type: Date, default: Date.now }
  }])
  messages: ChatMessage[];
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
