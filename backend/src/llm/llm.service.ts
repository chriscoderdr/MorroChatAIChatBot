import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

@Injectable()
export class LlmService {
  private readonly llm: ChatGoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get('ai.provider');

    if (provider === 'gemini') {
      this.llm = new ChatGoogleGenerativeAI({
        apiKey: this.configService.get<string>('GEMINI_API_KEY') || '',
        model: this.configService.get<string>('ai.model') || 'gemini-1.5-flash',
        temperature: this.configService.get<number>('ai.temperature') || 0,
        maxOutputTokens: this.configService.get<number>('ai.maxOutputTokens') || 1024,
      });
    } else {
      throw new Error('Invalid AI provider');
    }
  }

  getLlm() {
    return this.llm;
  }
}
