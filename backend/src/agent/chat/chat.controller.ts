import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatResponseDto } from 'src/dtos/chatResponseDto';
import { seconds, Throttle } from '@nestjs/throttler';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Throttle({
        default: {
            ttl: seconds(60), // 1 minute
            limit: 1 // 10 requests per minute
        }
    })
    @Post("")
    async chat(@Body() chatRequestDto: ChatRequestDto): Promise<ChatResponseDto> {
        const { message } = chatRequestDto;

        return {
            reply: await this.chatService.invoke(message)
        };
    }
}
