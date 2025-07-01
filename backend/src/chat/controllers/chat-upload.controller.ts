import { Res, Get } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { Controller, Post, UploadedFile, UseInterceptors, Body, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { PdfVectorService } from '../services/pdf-vector.service';
import { PdfRetrievalService } from '../services/pdf-retrieval.service';
import { LangChainService } from '../services/langchain.service';
import { AgentOrchestrator } from '../agent-orchestrator';
import { Request } from 'express';


@Controller('chat')
export class ChatUploadController {
  constructor(
    private readonly pdfVectorService: PdfVectorService,
    private readonly pdfRetrievalService: PdfRetrievalService,
    private readonly langChainService: LangChainService,
    private readonly chatService: ChatService,
  ) {}


  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: any,
    @Body('message') message: string,
    @Req() req: Request
  ) {
    const userId = req.browserSessionId;
    if (!userId) throw new Error('No user session found');

    await this.pdfVectorService.vectorizeAndStorePdf(file.buffer, userId, message);


    let answer: string | undefined = undefined;
    if (message) {
      // Multi-agent orchestration: document_search -> summarizer
      const steps = [
        {
          agent: 'document_search',
          input: async () => message,
        },
        {
          agent: 'summarizer',
          input: async (prevResult) => prevResult || '',
        },
      ];
      try {
        const { results } = await AgentOrchestrator.runSteps(steps, { userId });
        answer = results[results.length - 1].output;
      } catch (err) {
        answer = `Error during multi-agent orchestration: ${err.message}`;
      }
    }

    return {
      filename: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      message,
      status: 'vectorized',
      answer,
    };
  }
}
