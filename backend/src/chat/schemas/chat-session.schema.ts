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
  
  // Explicitly define timestamp fields that Mongoose adds
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
