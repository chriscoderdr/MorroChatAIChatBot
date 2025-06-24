import { Module } from '@nestjs/common';
import { GeminiService } from './services/gemini/gemini.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'Llm',
      useClass: GeminiService,
    }
  ],
  exports: ['Llm'],
})
export class LlmModule {}
