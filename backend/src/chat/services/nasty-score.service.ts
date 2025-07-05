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

  async getBlockMessage(userId: string): Promise<{ blockMessage: string | null, blockLanguage: string | null }> {
    const user = await this.nastyScoreModel.findOne({ userId }).exec();
    return {
      blockMessage: user?.blockMessage ?? null,
      blockLanguage: user?.blockLanguage ?? null,
    };
  }

  async setBlockMessage(userId: string, blockMessage: string, blockLanguage: string): Promise<void> {
    await this.nastyScoreModel.findOneAndUpdate(
      { userId },
      { blockMessage, blockLanguage },
      { new: true, upsert: true },
    ).exec();
  }

  async incrementScore(userId: string, amount = 1): Promise<number> {
    const user = await this.nastyScoreModel.findOneAndUpdate(
      { userId },
      { $inc: { score: amount } },
      { new: true, upsert: true },
    );
    return user.score;
  }
}
