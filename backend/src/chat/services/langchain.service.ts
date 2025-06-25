import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableConfig } from "@langchain/core/runnables";
import { concat } from "@langchain/core/utils/stream";
import { TavilySearch } from "@langchain/tavily";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(private readonly configService: ConfigService) { }

  async createLangChainApp(topic?: string) {
    const provider = this.configService.get<string>('ai.provider') || 'gemini';
    let model: BaseChatModel;
    
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      model = new ChatOpenAI({
        apiKey,
        modelName: process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0'),
        maxTokens: 1024,
      });
    } else {
      // Default to Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      model = new ChatGoogleGenerativeAI({
        apiKey,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0'),
        // Set a higher token limit to accommodate conversation history
        maxOutputTokens: 1024,
      });
    }
    
    this.logger.log(`Using AI provider: ${provider}`);

    const searchTool = new DynamicStructuredTool({
      name: "search",
      description:
        "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
      schema: z.object({
        query: z.string().describe("The query to use in your search."),
      }),
      func: async ({ query }: { query: string }) => {
        const tavily = new TavilySearch();
        try {
          const result = await tavily.invoke({ query });
          return result;
        } catch (error) {
          this.logger.error(`Error calling Tavily Search: ${error}`, error.stack);
          return "Failed to retrieve information from the web.";
        }
      },
    });

    const tools = [searchTool];

    const toolNode = new ToolNode(tools);

    // Both ChatOpenAI and ChatGoogleGenerativeAI support bindTools
    const boundModel = model.bindTools ? model.bindTools(tools) : model;

    const AgentState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    const shouldContinue = (state: typeof AgentState.State) => {
      const { messages } = state;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
        return "end";
      }
      return "continue";
    };

    const callModel = async (
      state: typeof AgentState.State,
      config?: RunnableConfig,
    ) => {
      const { messages } = state;
      let response: AIMessageChunk | undefined;
      for await (const message of await boundModel.stream(messages, config)) {
        if (!response) {
          response = message;
        } else {
          response = concat(response, message);
        }
      }
      return {
        messages: response ? [response as AIMessage] : [],
      };
    };

    const firstModel = async (state: typeof AgentState.State) => {
      const humanInput = state.messages[state.messages.length - 1].content || "";
      return {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                name: "search",
                args: {
                  query: humanInput,
                },
                id: "search-1"
              }
            ]
          })
        ]
      }
    }

    const workflow = new StateGraph(AgentState)
      .addNode("first_agent", firstModel)
      .addNode("agent", callModel)
      .addNode("action", toolNode)
      .addEdge(START, "first_agent")
      .addConditionalEdges(
        "first_agent",
        shouldContinue,
        {
          continue: "action",
          end: END,
        },
      )
      .addConditionalEdges(
        "agent",
        shouldContinue,
        {
          continue: "action",
          end: END,
        },
      )
      .addEdge("action", "agent");

    const app = workflow.compile();
    return app;
  }
}
