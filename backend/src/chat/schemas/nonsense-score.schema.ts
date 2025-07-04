import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class NonsenseScore extends Document {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ default: 0 })
  score: number;
}

export const NonsenseScoreSchema = SchemaFactory.createForClass(NonsenseScore);
