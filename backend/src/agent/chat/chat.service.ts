import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { TavilySearch } from '@langchain/tavily';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class ChatService implements OnModuleInit {
  private agent: RunnableWithMessageHistory<
    { input: string; current_date: string; current_location: string },
    string
  >;
  private messageStore: Record<string, InMemoryChatMessageHistory> = {};

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const llm = new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'gemini-1.5-flash',
      temperature: 0.7,
    });

    // We can pass options to the tool, like maxResults, for more concise output.
    const tools = [new TavilySearch({ maxResults: 3 })];

    const modelWithTools = llm.bindTools(tools);

    // FIX: A more robust, "agentic" system prompt that guides the model's reasoning.
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are Morro, a highly capable assistant. Your main goal is to provide accurate and up-to-date information.

        - You are connected to a live search tool. You MUST use this tool for any questions about current events, real-time information (like today's weather or news), or any topic where your internal knowledge might be outdated.
        - If a user asks about something "today", "now", or in a specific location, it is a very strong signal to use your search tool.
        - You have the following context, which you should use to inform your searches:
          - Current Date: {current_date}
          - User's Location: {current_location}
        - After getting search results, synthesize them into a friendly and helpful answer. Do not just repeat the search results. If you cannot find an answer after searching, say so.`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    const chain = prompt.pipe(modelWithTools).pipe(new StringOutputParser());

    // Update the agent's input type to include current_location
    this.agent = new RunnableWithMessageHistory({
      runnable: chain,
      getMessageHistory: (sessionId) => {
        if (!this.messageStore[sessionId]) {
          this.messageStore[sessionId] = new InMemoryChatMessageHistory();
        }
        return this.messageStore[sessionId];
      },
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
    });
  }

  async invoke(userMessage: string, sessionId: string): Promise<string> {
    console.log(`Invoking chat for session: ${sessionId}`);

    const result = await this.agent.invoke(
      {
        input: userMessage,
        current_date: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        // Pass the location context to the prompt
        current_location: 'Montecristi, Montecristi, Dominican Republic',
      },
      { configurable: { sessionId } },
    );

    return result;
  }
}