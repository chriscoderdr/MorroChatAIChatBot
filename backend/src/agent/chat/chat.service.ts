import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

@Injectable()
export class ChatService implements OnModuleInit {
  private agentExecutor: AgentExecutor;

  constructor(
    private readonly configService: ConfigService,
  ) { }

  onModuleInit() {
    const llm = new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'gemini-1.5-flash',
      temperature: 0,
    });

    const tools = [
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful assistant named Morro.'],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });
  }

  async invoke(
    userMessage: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<string> {
    const chatHistory = history.map((msg) => {
      return msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content);
    });

    const result = await this.agentExecutor.invoke({
      input: userMessage,
      chat_history: chatHistory,
    });

    return result.output;
  }
}