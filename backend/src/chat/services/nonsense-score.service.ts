import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NonsenseScore } from '../schemas/nonsense-score.schema';

@Injectable()
export class NonsenseScoreService {
  constructor(
    @InjectModel(NonsenseScore.name) private nonsenseScoreModel: Model<NonsenseScore>,
  ) {}

  async getScore(userId: string): Promise<number> {
    const user = await this.nonsenseScoreModel.findOne({ userId }).exec();
    return user ? user.score : 0;
  }

  async incrementScore(userId: string): Promise<number> {
    const user = await this.nonsenseScoreModel.findOneAndUpdate(
      { userId },
      { $inc: { score: 1 } },
      { new: true, upsert: true },
    );
    return user.score;
  }
}
