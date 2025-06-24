import { Inject, Injectable } from '@nestjs/common';
import { Llm } from '../../llm/interfaces/llm.interface';


@Injectable()
export class ChatService {
  constructor(
    @Inject('Llm') private readonly llm: Llm,
  ) {}

  async invoke(userMessage: string): Promise<string> {
    // A simple agent-like logic: if the user asks to search, use the tool.
    if (userMessage.toLowerCase().includes('search for')) {
      const query = userMessage.substring(userMessage.toLowerCase().indexOf('search for') + 11).trim();
      const searchResult = '';
      const finalPrompt = `Based on the following search results, answer the user's original query.\n\nSearch Results: ${searchResult}\n\nUser Query: ${userMessage}`;
      return this.llm.generateResponse(finalPrompt);
    }

    // Otherwise, just send the message to the LLM.
    return this.llm.generateResponse(userMessage);
  }
}