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
  ) { }

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
      schema: z.object({ timezone: z.string().describe("A valid IANA timezone name, e.g., 'America/Santo_Domingo'.") }),
      func: async ({ timezone }) => {
        try {
          return new Date().toLocaleString("en-US", { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
        } catch (e) { return `Failed to get time. '${timezone}' is not a valid IANA timezone.`; }
      },
    });
    const openWeatherMapTool = new DynamicStructuredTool({
      name: "open_weather_map",
      description: "Provides the current weather for a specific city.",
      schema: z.object({ location: z.string().describe("The city and country, e.g., 'Santo Domingo, DO'.") }),
      func: async ({ location }: { location: string }) => {
        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        if (!apiKey) return "OpenWeatherMap API key is missing.";
        try {
          const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
          const geoRes = await fetch(geoUrl);
          const geoData = await geoRes.json();
          if (!geoRes.ok || geoData.length === 0) return `Could not find location data for ${location}.`;
          const { lat, lon, name, country } = geoData[0];
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
          const weatherRes = await fetch(weatherUrl);
          const weatherData = await weatherRes.json();
          if (!weatherRes.ok) return `Failed to fetch weather. Error: ${weatherData.message || 'Unknown'}`;
          const { temp, feels_like, humidity } = weatherData.main;
          return `Current weather in ${name}, ${country}: ${weatherData.weather[0].description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%.`;
        } catch (error) { return `An error occurred while fetching weather for ${location}.`; }
      },
    });

    const tools = [searchTool, currentTimeTool, openWeatherMapTool];
    const llmWithTools = llm.bindTools ? llm.bindTools(tools) : llm;

    const createAgentExecutor = (systemMessage: string): AgentExecutor => {
      let finalSystemMessage = systemMessage;
      if (topic) {
        finalSystemMessage = `Your most important rule is that you are an assistant dedicated ONLY to the topic of "${topic}". You must politely refuse any request that is not directly related to this topic.\n\n` + systemMessage;
      }
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", finalSystemMessage],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
      ]);
      const agent = createToolCallingAgent({ llm: llmWithTools, tools, prompt });
      return new AgentExecutor({ agent, tools, verbose: true });
    };

    const timeAgent = createAgentExecutor(`You are a time-specialist. Use tools to answer time-related questions. If you need an IANA timezone, use 'search' to find it first. Use chat history for context.`);
    const weatherAgent = createAgentExecutor(`You are a weather specialist. Use 'open_weather_map' for weather questions. Use chat history to create specific location queries for follow-ups.`);
    const generalAgent = createAgentExecutor(`You are a master research assistant. Your instructions are absolute.

- **Goal:** Answer the user's question in their own language by finding information on the web.
- **Primary Tool:** You MUST use the 'search' tool to find information. Do not apologize or claim you cannot access information. **Before providing any answer, or if you need more information, you MUST use the search tool to verify and get the most up-to-date information, even if you think you already know the answer.**

**Research Methodology (You must follow this step-by-step process):**
1.  **THOUGHT:** Analyze the user's latest query and the chat history. What is their true intent? What is the core entity they are asking about (e.g., "Soluciones GBH")? Formulate a plan that *begins with using the search tool for every new query*.
2.  **ACTION:**
    - **Formulate Query:** Create a concise, keyword-based search query in the user's language. Use the chat history to add context (e.g., "Soluciones GBH founders" not just "founders").
    - **Execute Tool:** Call the \`search\` tool with your query.
3.  **OBSERVATION:** [You will receive the search results from the tool here]
4.  **THOUGHT:** Analyze the search results.
    - Did I find a definitive answer? If yes, proceed to Final Answer.
    - Are the results ambiguous or insufficient? If yes, I must try a different search.
5.  **ACTION (if necessary):**
    - **Reformulate Query:** Create a SECOND, different search query. Try a different angle.
    - **Targeted Search (Example):** For questions about people, founders, or companies, a great second search is to add "LinkedIn" to the query (e.g., "José Bonetti Soluciones GBH LinkedIn"). For current events or statistics, try adding the current year or "official data" (e.g., "current inflation rates 2025," "NASA Artemis program status").
    - **Execute Tool:** Call the \`search\` tool with the new query.
6.  **FINAL ANSWER:** After you have sufficient information from your research, synthesize it into a helpful, conversational answer in the user's original language. Do not include the "Thought:", "Action:", or "Final Answer:" prefixes in your response.`);

    // This is our main runnable. It's a single Lambda that contains all the logic.
    const finalRunnable = new RunnableLambda({
      func: async (input: { input: string; chat_history: BaseMessage[] }) => {
        const lowerCaseInput = input.input.toLowerCase();
        const lastAIMessage = input.chat_history.filter(m => m._getType() === 'ai').slice(-1)[0]?.content.toString().toLowerCase() ?? "";

        const timeKeywords = ['hora', 'time', 'fecha', 'date', 'día', 'dia'];
        const weatherKeywords = ['clima', 'temperatura', 'weather', 'pronóstico', 'forecast', 'tiempo'];

        let selectedAgent: AgentExecutor;

        if (timeKeywords.some(k => lowerCaseInput.includes(k)) || lastAIMessage.includes("time") || lastAIMessage.includes("hora")) {
          this.logger.debug("Routing to Time Agent");
          selectedAgent = timeAgent;
        } else if (weatherKeywords.some(k => lowerCaseInput.includes(k)) || lastAIMessage.includes("weather") || lastAIMessage.includes("clima")) {
          this.logger.debug("Routing to Weather Agent");
          selectedAgent = weatherAgent;
        } else {
          this.logger.debug("Routing to General Agent");
          selectedAgent = generalAgent;
        }

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
      outputMessagesKey: "output",
    });

    return agentWithHistory;
  }
}