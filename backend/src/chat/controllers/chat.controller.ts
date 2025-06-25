import { Body, Controller, Get, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatResponseDto } from '../dto/chat-response.dto';
import { seconds, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Process a chat request' })
  @ApiResponse({ 
    status: 201, 
    description: 'Chat processed successfully', 
    type: ChatResponseDto 
  })
  @ApiBody({ 
    type: ChatRequestDto, 
    description: 'Chat request with user message' 
  })
  @Throttle({
    default: {
      ttl: seconds(60),
      limit: 20
    }
  })
  @Post()
  async chat(
    @Req() req: Request,
    @Body() chatRequestDto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const { message } = chatRequestDto;
    
    // Use the browser's session ID from middleware
    const browserSessionId = req.browserSessionId || 'anonymous';
    
    // Use browserSessionId for everything - no need for a separate chatSessionId
    const result = await this.chatService.processChat(message, null, browserSessionId);
    
    
    return { 
      reply: result.reply,
      // We no longer need to send the sessionId back to the frontend
    };
  }

  @ApiOperation({ summary: 'Get chat history for the current session' })
  @ApiResponse({ status: 200, description: 'Chat history retrieved successfully' })
  @Get('history')
  async getSessionHistory(
    @Req() req: Request,
  ) {
    // Use the browser's session ID from middleware
    const browserSessionId = req.browserSessionId || 'anonymous';
    
    // Get chat history for this browser session
    return this.chatService.getSessionHistoryByUserId(browserSessionId);
  }
}
