import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatResponseDto } from 'src/dtos/chatResponseDto';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post("")
    async chat(@Body() chatRequestDto: ChatRequestDto): Promise<ChatResponseDto> {
        const { message } = chatRequestDto;

        return {
            reply: await this.chatService.invoke(message)
        };
    }
}
