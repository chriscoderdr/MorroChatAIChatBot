import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatResponseDto } from '../dto/chat-response.dto';
import { seconds, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Process a chat request without session' })
  @ApiResponse({ status: 201, description: 'Chat processed successfully', type: ChatResponseDto })
  @ApiBody({ type: ChatRequestDto, description: 'Chat request with user message' })
  @Throttle({
    default: {
      ttl: seconds(60),
      limit: 20
    }
  })
  @Post()
  async chatWithoutSession(
    @Body() chatRequestDto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    // In a real app, you would get the userId from the authentication context
    const userId = '111';
    
    const { message } = chatRequestDto;
    const reply = await this.chatService.invoke(message, null, userId);
    
    return { reply };
  }

  @ApiOperation({ summary: 'Process a chat request with session' })
  @ApiResponse({ status: 201, description: 'Chat processed successfully', type: ChatResponseDto })
  @ApiBody({ type: ChatRequestDto, description: 'Chat request with user message' })
  @ApiParam({ name: 'sessionId', description: 'The ID of the chat session' })
  @Throttle({
    default: {
      ttl: seconds(60),
      limit: 20
    }
  })
  @Post(':sessionId')
  async chatWithSession(
    @Body() chatRequestDto: ChatRequestDto,
    @Param('sessionId') sessionId: string,
  ): Promise<ChatResponseDto> {
    // In a real app, you would get the userId from the authentication context
    const userId = '111';
    
    const { message } = chatRequestDto;
    const reply = await this.chatService.invoke(message, sessionId, userId);
    
    return { reply };
  }

  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({ status: 201, description: 'Session created successfully', schema: { 
    properties: { sessionId: { type: 'string' } } 
  }})
  @Post('sessions')
  async createSession(): Promise<{ sessionId: string }> {
    // In a real app, you would get the userId from the authentication context
    const userId = '111';
    const sessionId = await this.chatService.createSession(userId);
    return { sessionId };
  }

  @ApiOperation({ summary: 'Get chat history for a session' })
  @ApiResponse({ status: 200, description: 'Chat history retrieved successfully' })
  @ApiParam({ name: 'sessionId', description: 'The ID of the chat session' })
  @Get('sessions/:sessionId/history')
  async getSessionHistory(
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getSessionHistory(sessionId);
  }
}
