import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NastyScore } from '../schemas/nasty-score.schema';

@Injectable()
export class NastyScoreService {
  constructor(
    @InjectModel(NastyScore.name) private nastyScoreModel: Model<NastyScore>,
  ) {}

  async getScore(userId: string): Promise<number> {
    const user = await this.nastyScoreModel.findOne({ userId }).exec();
    return user ? user.score : 0;
  }

  async incrementScore(userId: string): Promise<number> {
    const user = await this.nastyScoreModel.findOneAndUpdate(
      { userId },
      { $inc: { score: 1 } },
      { new: true, upsert: true },
    );
    return user.score;
  }
}
