import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ChatService } from '../service/chat.service';
import { ChatResponseDto } from 'src/dtos/chatResponseDto';
import { seconds, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ChatRequestDto } from 'src/dtos/chatRequestDto';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { 
        console.log('ChatController initialized');
    }

    @Throttle({
        default: {
            ttl: seconds(60),
            limit: 20
        }
    })
    @Post()
    async chat(@Body() chatRequestDto: ChatRequestDto, @Req() req: Request): Promise<ChatResponseDto> {
        const { message } = chatRequestDto;
        
        // Ensure browserSessionId is available (it should be set by the middleware)
        const sessionId = req.browserSessionId || 'default-session';
        
        return {
            reply: await this.chatService.invoke(message, sessionId)
        };
    }
    
    @Get('status')
    getStatus() {
        return { 
            status: 'ok', 
            time: new Date().toISOString(),
            endpoint: 'chat status' 
        };
    }
    
    @Get('diagnostics')
    async getDiagnostics() {
        // Return system diagnostics for debugging
        return {
            timestamp: new Date().toISOString(),
            status: 'online',
            session: {
                enabled: true,
                cookieName: 'browserSessionId'
            },
            environment: {
                node: process.version,
                platform: process.platform
            }
        };
    }
}
