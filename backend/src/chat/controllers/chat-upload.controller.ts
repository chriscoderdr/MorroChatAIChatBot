import { Logger } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { PdfVectorService } from '../services/pdf-vector.service';
import { Request } from 'express';
import { Multer } from 'multer';

@Controller('chat')
export class ChatUploadController {
  private readonly logger = new Logger(ChatUploadController.name);

  constructor(
    private readonly pdfVectorService: PdfVectorService,
    private readonly chatService: ChatService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: Multer.File,
    @Body('message') message: string,
    @Req() req: Request,
  ) {
    try {
      const userId = req.browserSessionId;
      if (!userId) {
        this.logger.error('No user session found in request');
        throw new Error('No user session found');
      }

      this.logger.log(
        `Starting PDF upload for user ${userId}. File: ${file?.originalname}, Size: ${file?.size} bytes`,
      );

      if (!file) {
        this.logger.error('No file uploaded');
        throw new Error('No file uploaded');
      }

      const vectorizeResult = await this.pdfVectorService.vectorizeAndStorePdf(
        file.buffer,
        userId,
        message,
      );
      this.logger.log(
        `Vectorization complete. Result: ${JSON.stringify(vectorizeResult)}`,
      );

      let answer: string | undefined = undefined;
      if (message && message.trim()) {
        try {
          this.logger.log(`Processing user message: "${message}"`);

          // Add document upload context to chat history for proper routing
          const documentContext = `[PDF Uploaded] ${file.originalname}`;
          await this.chatService.addDocumentContext(userId, documentContext);

          // Now process the message through the normal chat flow with document context
          const result = await this.chatService.processChat(message, userId);
          answer =
            result.reply ||
            'Document uploaded successfully. You can now ask questions about it.';

          this.logger.log(
            `User message processed successfully. Answer length: ${answer?.length || 0} chars`,
          );
        } catch (err: any) {
          this.logger.error('Error processing document question:', err);
          answer =
            'Document uploaded successfully. You can now ask questions about it.';
        }
      } else {
        answer =
          'Document uploaded successfully. You can now ask questions about it.';
      }

      return {
        filename: file?.originalname,
        mimetype: file?.mimetype,
        size: file?.size,
        message,
        status: 'vectorized',
        answer,
      };
    } catch (error) {
      this.logger.error('Error in uploadPdf:', error);
      throw error; // Re-throw to let NestJS handle the HTTP error response
    }
  }
}
