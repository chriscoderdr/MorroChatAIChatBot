import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// This schema represents the nested 'data' object within a LangChain StoredMessage.
// We disable _id generation for this sub-document.
@Schema({ _id: false })
class StoredMessageData {
  @Prop({ required: true })
  content: string;

  @Prop()
  role?: string;

  @Prop()
  name?: string;

  // We use a generic Object type to handle complex properties like tool_calls
  @Prop({ type: Array, default: undefined })
  tool_calls?: Record<string, any>[];

  @Prop()
  tool_call_id?: string;
}
const StoredMessageDataSchema = SchemaFactory.createForClass(StoredMessageData);

// This schema represents a single LangChain StoredMessage.
@Schema({ _id: false })
export class StoredMongoMessage {
  @Prop({ required: true })
  type: string; // e.g., "human", "ai", "system"

  @Prop({ type: StoredMessageDataSchema, required: true })
  data: StoredMessageData;
}
const StoredMongoMessageSchema =
  SchemaFactory.createForClass(StoredMongoMessage);

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop()
  topic?: string;

  // Our 'messages' property is now a fully-typed array of StoredMongoMessage sub-documents.
  @Prop({ type: [StoredMongoMessageSchema], default: [] })
  messages: StoredMongoMessage[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
