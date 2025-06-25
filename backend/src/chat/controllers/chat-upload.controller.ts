import { Controller, Post, UploadedFile, UseInterceptors, Body, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { PdfVectorService } from '../services/pdf-vector.service';
import { PdfRetrievalService } from '../services/pdf-retrieval.service';
import { LangChainService } from '../services/langchain.service';
import { Request } from 'express';


@Controller('chat')
export class ChatUploadController {
  constructor(
    private readonly pdfVectorService: PdfVectorService,
    private readonly pdfRetrievalService: PdfRetrievalService,
    private readonly langChainService: LangChainService,
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
      // Embed the question using Gemini
      const embedder = new (require('@langchain/google-genai').GoogleGenerativeAIEmbeddings)({ apiKey: process.env.GEMINI_API_KEY });
      const [queryEmbedding] = await embedder.embedDocuments([message]);
      // Retrieve similar chunks from Chroma
      const results = await this.pdfRetrievalService.similaritySearch(userId, queryEmbedding, 5);
      const contextChunks = (results.documents?.[0] || []).join('\n\n');
      // Use Gemini LLM to answer the question with the context
      const llm = await this.langChainService.createLangChainApp();
      const response = await llm.invoke({
        input: `Given the following document context, answer the user's question.\n\nContext:\n${contextChunks}\n\nQuestion: ${message}`,
        chat_history: [],
      });
      answer = typeof response === 'string' ? response : (response as any).output;
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
