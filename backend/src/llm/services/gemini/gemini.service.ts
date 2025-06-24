import { Injectable } from '@nestjs/common';
import { Llm } from '../../interfaces/llm.interface';

@Injectable()
export class GeminiService implements Llm {
  async generateResponse(prompt: string): Promise<string> {
    console.log(`Sending prompt to Gemini: "${prompt}"`);
    return Promise.resolve(`Gemini's response to: "${prompt}"`);
  }
}