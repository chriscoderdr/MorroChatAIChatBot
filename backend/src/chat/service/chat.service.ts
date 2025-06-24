import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { createLangChainApp } from '../langchain.factory';
@Injectable()
export class ChatService implements OnModuleInit {
  langChainApp: any;

  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    this.langChainApp = await createLangChainApp(
      this.configService.get<string>('GEMINI_API_KEY') || "",
      "Dominican Food"
    );

  }

  async invoke(userMessage: string, sessionId: string): Promise<string> {
    const inputs = {
      messages: [new HumanMessage(userMessage)]
    }
    let finalResponseContent: string = "";
    for await (const output of await this.langChainApp.stream(inputs)) {
      console.log(output)
      console.log("-----\n")

      if (output?.agent?.messages) {
        finalResponseContent += (output.agent.messages[0]  as AIMessageChunk).text;
      } else if (output?.first_agent?.messages) {
        finalResponseContent += (output.first_agent.messages[0] as AIMessageChunk).content;
      }
    }
    return finalResponseContent;

  }

}