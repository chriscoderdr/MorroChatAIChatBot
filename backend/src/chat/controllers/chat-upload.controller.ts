import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('chat')
export class ChatUploadController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: any,
    @Body('message') message: string
  ) {
    // For now, just return file info and message for frontend integration
    return {
      filename: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      message,
      // You can add more fields as needed for future processing
    };
  }
}
