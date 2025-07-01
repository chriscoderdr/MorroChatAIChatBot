import { Res, Get, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(ChatUploadController.name);

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
      try {
        // Add document upload context to chat history for proper routing
        const documentContext = `[PDF Uploaded] ${file.originalname}`;
        await this.chatService.addDocumentContext(userId, documentContext);
        
        // Now process the message through the normal chat flow with document context
        const result = await this.chatService.processChat(message, userId);
        answer = result.reply || "Document uploaded successfully. You can now ask questions about it.";
      } catch (err) {
        this.logger.error('Error processing document question:', err);
        answer = "Document uploaded successfully. You can now ask questions about it.";
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
