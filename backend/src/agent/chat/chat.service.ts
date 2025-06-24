import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
    invoke(userMessage: string): Promise<string> {
        return Promise.resolve("Hello, how can I assist you today?");
    }
}
