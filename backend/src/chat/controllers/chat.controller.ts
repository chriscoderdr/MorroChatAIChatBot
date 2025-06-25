// chat.controller.ts (Corrected)

import { Body, Controller, Get, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/chat.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatResponseDto } from '../dto/chat-response.dto';
import { seconds, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @ApiOperation({ summary: 'Clear the current chat session cookie' })
  @ApiResponse({ status: 200, description: 'Session cookie cleared' })
  @Post('new')
  async createNewSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Clear the old browserSessionId cookie
    res.clearCookie('browserSessionId', { path: '/' });
    // Only clear the cookie; do not create a new session or set a new cookie
    return { success: true };
  }

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
    const browserSessionId = req.browserSessionId || 'anonymous';

    // We pass the userId (browserSessionId) directly to processChat.
    const result = await this.chatService.processChat(message, browserSessionId);

    return {
      reply: result.reply,
    };
  }

  @ApiOperation({ summary: 'Get chat history for the current session' })
  @ApiResponse({ status: 200, description: 'Chat history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No active chat session found' })
  @Get('history')
  async getSessionHistory(
    @Req() req: Request,
  ) {
    const browserSessionId = req.browserSessionId;

    if (!browserSessionId) {
      // If there's no session ID, there can be no history.
      return [];
    }

    return this.chatService.getSessionHistory(browserSessionId);
  }
}