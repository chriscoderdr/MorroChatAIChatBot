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
import { StringOutputParser } from "@langchain/core/output_parsers";

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {}

  async createLangChainApp(topic?: string) {
    const provider = this.configService.get<string>('ai.provider') || 'gemini';
    let llm: BaseChatModel;
    if (provider === 'openai') {
        llm = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, modelName: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0 });
    } else {
        llm = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', temperature: 0 });
    }

    const searchTool = new DynamicStructuredTool({
        name: "search",
        description: "Searches the web for up-to-date information.",
        schema: z.object({ query: z.string().describe("A keyword-based search query.") }),
        func: async ({ query }) => { try { return await new TavilySearch().invoke({ query }); } catch (e) { this.logger.error(`Tavily search failed for query: ${query}`, e.stack); return "Search failed."; } },
    });
    const currentTimeTool = new DynamicStructuredTool({
        name: "current_time",
        description: "Gets the current date and time for a specific IANA timezone.",
        schema: z.object({ timezone: z.string().describe("A valid IANA timezone name, e.g., 'America/New_York'.") }),
        func: async ({ timezone }) => {
            try {
                return new Date().toLocaleString("en-US", { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
            } catch (e) { return `Failed to get time. '${timezone}' is not a valid IANA timezone.`; }
        },
    });

    const tools = [searchTool, currentTimeTool];
    const llmWithTools = llm.bindTools ? llm.bindTools(tools) : llm;
    
    const createAgentExecutor = (systemMessage: string): AgentExecutor => {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemMessage],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
        ]);
        const agent = createToolCallingAgent({ llm: llmWithTools, tools, prompt });
        return new AgentExecutor({ agent, tools, verbose: true });
    };

    const timeAgent = createAgentExecutor(`You are a time-specialist. Use your tools to answer time-related questions. If you need an IANA timezone, use the 'search' tool to find it first.`);
    const generalAgent = createAgentExecutor(`You are a master research assistant. Use the 'search' tool to answer questions. Formulate specific, keyword-based queries in the user's language. Use the chat history to create better search queries for follow-up questions. If your first search fails, try a different query.`);

    // This is our main runnable. It's a single Lambda that contains all the logic.
    const finalRunnable = new RunnableLambda({
        func: async (input: { input: string; chat_history: BaseMessage[] }) => {
            // 1. Topic Guard Check (if topic is set)
            if (topic) {
                const topicPrompt = ChatPromptTemplate.fromTemplate(`Is the following question: "{input}" related to the topic of "${topic}"? Answer only with a single word: "yes" or "no".`);
                const topicChecker = topicPrompt.pipe(llm).pipe(new StringOutputParser());
                const topicResponse = await topicChecker.invoke(input);
                if (topicResponse.toLowerCase().includes("no")) {
                    this.logger.warn(`Off-topic query blocked by Topic Guard: "${input.input}"`);
                    return { output: `I'm sorry, I can only answer questions related to the topic of "${topic}".` };
                }
            }

            // 2. Agent Router
            const lowerCaseInput = input.input.toLowerCase();
            const timeKeywords = ['hora', 'time', 'fecha', 'date', 'día', 'dia'];
            let selectedAgent: AgentExecutor;

            if (timeKeywords.some(k => lowerCaseInput.includes(k))) {
                this.logger.debug("Routing to Time Agent");
                selectedAgent = timeAgent;
            } else {
                this.logger.debug("Routing to General Agent");
                selectedAgent = generalAgent;
            }

            // 3. Invoke the selected agent
            return selectedAgent.invoke({
                input: input.input,
                chat_history: input.chat_history
            });
        }
    });

    const agentWithHistory = new RunnableWithMessageHistory({
        runnable: finalRunnable,
        getMessageHistory: (sessionId: string) => new MongoDBChatMessageHistory(this.chatSessionModel, sessionId),
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
        outputMessagesKey: "output"
    });

    return agentWithHistory;
  }
}