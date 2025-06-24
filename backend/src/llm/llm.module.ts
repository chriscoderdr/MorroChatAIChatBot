import { Module } from '@nestjs/common';
import { GeminiService } from './services/gemini/gemini.service';

@Module({
  providers: [
    {
      provide: 'Llm',
      useClass: GeminiService,
    }
  ],
  exports: ['Llm'],
})
export class LlmModule {}
