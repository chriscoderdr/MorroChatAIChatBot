import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from '../services/chat.service';

@Controller('history')
export class HistoryController {
    constructor(private readonly chatService: ChatService) {
        console.log('HistoryController initialized');
    }
    
    @Get()
    async getChatHistory(@Req() req: Request) {
        // Get the browser session ID from the request
        const sessionId = req.browserSessionId || 'default-session';
        
        console.log(`Getting history for session: ${sessionId}`);
        
        // Get the chat history for this session
        return this.chatService.getSessionHistory(sessionId);
    }
    
    @Get('status')
    getStatus() {
        return { 
            status: 'ok', 
            time: new Date().toISOString(),
            endpoint: 'history status' 
        };
    }
}
