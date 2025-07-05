import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';


@Schema({ timestamps: true })
export class NastyScore extends Document {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ type: String, default: null })
  blockMessage?: string | null;

  @Prop({ type: String, default: null })
  blockLanguage?: string | null;
}

export const NastyScoreSchema = SchemaFactory.createForClass(NastyScore);
