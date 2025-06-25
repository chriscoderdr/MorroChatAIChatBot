import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableLambda, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { MongoDBChatMessageHistory } from "./mongodb.chat.message.history";
import { InjectModel } from "@nestjs/mongoose";
import { ChatSession } from "../schemas/chat-session.schema";
import { Model } from "mongoose";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { BaseMessage } from "@langchain/core/messages";

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {}

  async createLangChainApp() {
    // --- Model Definition ---
    const provider = this.configService.get<string>('ai.provider') || 'gemini';
    let llm: BaseChatModel;
    if (provider === 'openai') {
        llm = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, modelName: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0 });
    } else {
        llm = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', temperature: 0 });
    }

    // --- Tool Definitions ---
    const searchTool = new DynamicStructuredTool({
        name: "search",
        description: "Searches the web for up-to-date information. Use this for any general knowledge question, or to find information needed for other tools (like finding an IANA timezone).",
        schema: z.object({ query: z.string().describe("The search query.") }),
        func: async ({ query }) => { try { return await new TavilySearch().invoke({ query }); } catch (e) { return "Search failed"; } },
    });
    const currentTimeTool = new DynamicStructuredTool({
        name: "current_time",
        description: "Gets the current date and time for a specific IANA timezone.",
        schema: z.object({ timezone: z.string().describe("A valid IANA timezone name, e.g., 'America/New_York', 'Europe/London', or 'Asia/Manila'.") }),
        func: async ({ timezone }) => {
            try {
                return new Date().toLocaleString("en-US", { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
            } catch (e) { return `Failed to get time. '${timezone}' is not a valid IANA timezone.`; }
        },
    });

    const tools = [searchTool, currentTimeTool];
    const llmWithTools = llm.bindTools ? llm.bindTools(tools) : llm;
    
    // --- Agent Creation Function ---
    const createAgentExecutor = (systemMessage: string): Promise<AgentExecutor> => {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemMessage],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
        ]);
        const agent = createToolCallingAgent({ llm: llmWithTools, tools, prompt });
        return Promise.resolve(new AgentExecutor({ agent, tools, verbose: true }));
    };

    // --- Sub-Agents for Different Tasks ---
    const timeAgent = await createAgentExecutor(`You are a specialist time-telling assistant. Your goal is to answer questions about the current time.
- To do this, you must determine the IANA timezone for each location the user mentions.
- Use the 'search' tool to find the IANA timezone if you don't know it.
- Once you have the IANA timezone, use the 'current_time' tool to get the time.
- Always perform these steps. Do not ask for permission. Do not say you cannot do it.`);

    const generalAgent = await createAgentExecutor(`You are a helpful assistant. Your goal is to answer general knowledge questions.
- To do this, you MUST use the 'search' tool.
- Do not apologize or claim you cannot access information. Use the search tool to find it.`);

    // --- Router to Select the Correct Agent ---
    const router = new RunnableLambda({
        func: async ({ input, chat_history }: { input: string; chat_history: BaseMessage[] }) => {
            const lowerCaseInput = input.toLowerCase();
            const timeKeywords = ['hora', 'time', 'fecha', 'date', 'día es hoy'];
            if (timeKeywords.some(k => lowerCaseInput.includes(k))) {
                this.logger.debug("Routing to Time Agent");
                return await timeAgent.invoke({ input, chat_history });
            }
            this.logger.debug("Routing to General Agent");
            return await generalAgent.invoke({ input, chat_history });
        }
    });

    // --- The Final Chain with History ---
    const agentWithHistory = new RunnableWithMessageHistory({
        runnable: router, // The router now directly handles the invocation
        getMessageHistory: (sessionId: string) => new MongoDBChatMessageHistory(this.chatSessionModel, sessionId),
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
        // The output of an AgentExecutor is an object with an "output" key
        // The history wrapper needs to know this to save the correct message.
        outputMessagesKey: "output",
    });

    return agentWithHistory;
  }
}