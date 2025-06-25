import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
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
    const systemPrompt =
      "You are a helpful assistant. First, detect the user's language and always reply in that same language. Your primary goal is to provide accurate, up-to-date answers by using tools. Prioritize specific tools: for time/date queries use 'current_time'; for weather use 'open_weather_map'. If no specific tool fits, use the 'search' tool for any query requiring current information. Never recommend a site; always use a tool to get the answer.";

    const CurrentTimeTool = new DynamicStructuredTool({
        name: "current_time",
        description: "Gets the current date and time for a specific IANA timezone.",
        schema: z.object({
            timezone: z.string().describe("A valid IANA timezone name, e.g., 'America/New_York', 'Europe/London', or 'Asia/Manila'."),
        }),
        func: async ({ timezone }: { timezone: string }) => {
            try {
                const formattedTime = new Date().toLocaleString("en-US", {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', second: '2-digit',
                    timeZone: timezone,
                    timeZoneName: 'short'
                });
                return `In the ${timezone} timezone, the current time is: ${formattedTime}.`;
            } catch (error) {
                this.logger.error(`Error in CurrentTimeTool for timezone '${timezone}': ${error.message}`);
                return `Failed to get time. '${timezone}' is not a valid IANA timezone. Please provide a valid one, like 'America/New_York'.`;
            }
        },
    });

    const WebsiteFetchTool = new DynamicStructuredTool({
      name: "website_fetch",
      description: "Fetches and extracts text content from a specific URL. Use this to get information from a webpage when you have its direct link.",
      schema: z.object({
        url: z.string().describe("The full URL of the website to fetch."),
      }),
      func: async ({ url }: { url: string }) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          return text.slice(0, 4000);
        } catch (error) {
          this.logger.error(`Error fetching website: ${url} - ${error}`);
          return `Failed to fetch content from ${url}`;
        }
      },
    });

    const OpenWeatherMapTool = new DynamicStructuredTool({
      name: "open_weather_map",
      description: "Provides the current weather for a specific city. Use this for any weather-related questions.",
      schema: z.object({
        location: z.string().describe("The city and country, e.g., 'San Francisco, US' or 'Tokyo, JP'."),
      }),
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
        } catch (error) {
          return `An error occurred while fetching weather for ${location}.`;
        }
      },
    });
    
    const searchTool = new DynamicStructuredTool({
      name: "search",
      description: "Searches the web for up-to-date information. Use this as your default tool for any general question that cannot be answered by a more specific tool (like the weather or time tool).",
      schema: z.object({
        query: z.string().describe("The search query."),
      }),
      func: async ({ query }: { query: string }) => {
        try {
          const tavily = new TavilySearch();
          return await tavily.invoke({ query });
        } catch (error) {
          this.logger.error(`Error calling Tavily Search: ${error}`, error.stack);
          return "Failed to retrieve information from the web.";
        }
      },
    });

    const provider = this.configService.get<string>('ai.provider') || 'gemini';
    let model: BaseChatModel;

    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      model = new ChatOpenAI({ apiKey, modelName: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0 });
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      model = new ChatGoogleGenerativeAI({ apiKey, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', temperature: 0 });
    }

    const tools = [searchTool, WebsiteFetchTool, OpenWeatherMapTool, CurrentTimeTool];
    const boundModel = model.bindTools ? model.bindTools(tools) : model;
    
    const AgentState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({ reducer: (x, y) => x.concat(y) }),
      forceAnswerCount: Annotation<number>({ default: () => 0, reducer: (x, y) => typeof y === 'number' ? y : x }),
      originalQuery: Annotation<string>({ default: () => "", reducer: (x, y) => typeof y === 'string' ? y : x }),
    });

    const shouldContinue = (state: typeof AgentState.State) => {
      const { messages, forceAnswerCount = 0 } = state;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return "action";
      const content = (Array.isArray(lastMessage.content) ? lastMessage.content.join(' ') : lastMessage.content || "").toLowerCase();
      if (/recomiendo|visita|no puedo|lo siento, pero/.test(content) && forceAnswerCount < 3) return "force_answer";
      return "end";
    };

    const callModel = async (state: typeof AgentState.State, config?: RunnableConfig) => {
      const system_message_exists = state.messages.some(m => m._getType() === 'system');
      const all_messages = system_message_exists ? state.messages : [new SystemMessage({ content: systemPrompt }), ...state.messages];
      const response = await boundModel.stream(all_messages, config);
      let finalResponse: AIMessageChunk | undefined;
      for await (const chunk of response) {
        finalResponse = !finalResponse ? chunk : concat(finalResponse, chunk);
      }
      return { messages: finalResponse ? [finalResponse as AIMessage] : [] };
    };

    // FIXED: The router now provides a flexible plan instead of a rigid command.
    const firstModel = async (state: typeof AgentState.State) => {
      const humanInput = state.originalQuery || '';
      const lowerCaseOriginalQuery = humanInput.toLowerCase();
      let instruction: string;

      const timeKeywords = ['hora', 'time', 'fecha', 'date', 'día es hoy', 'que dia es'];
      const weatherKeywords = ['clima', 'temperatura', 'weather', 'pronóstico', 'forecast', 'tiempo'];

      if (timeKeywords.some(k => lowerCaseOriginalQuery.includes(k))) {
        this.logger.debug(`First agent detected TIME query: "${humanInput}"`);
        instruction = `The user is asking for the time in a location: "${humanInput}". To answer this, you must find the current time.
1. The 'current_time' tool can get the time, but it requires a precise IANA timezone (e.g., 'America/Santo_Domingo').
2. If you do not know the exact IANA timezone for the location mentioned, you MUST use the 'search' tool first to find it. A good search query is "IANA timezone for [location]".
3. Once you have the IANA timezone, call the 'current_time' tool to get the final answer.
If no location is specified, assume the location is the Philippines and use the 'Asia/Manila' timezone.`;
      } else if (weatherKeywords.some(k => lowerCaseOriginalQuery.includes(k))) {
        this.logger.debug(`First agent detected WEATHER query: "${humanInput}"`);
        instruction = `The user's query is "${humanInput}". This is a weather query. You MUST call the 'open_weather_map' tool. Extract the location from the user's query to use as the 'location' argument.`;
      } else {
        this.logger.debug(`First agent detected GENERAL query: "${humanInput}"`);
        instruction = `The user's query is "${humanInput}". This is a general knowledge question. You MUST call the 'search' tool to get an up-to-date answer. Use the user's query as the 'query' argument for the tool.`;
      }
      
      return {
        messages: [
          ...state.messages,
          new HumanMessage({ content: instruction })
        ]
      };
    };

    const actionWithToolMessage = async (state: typeof AgentState.State) => {
      const { messages, originalQuery } = state;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      const generatedMessages: BaseMessage[] = [];

      if (!lastMessage.tool_calls) return { messages: [] };

      for (const toolCall of lastMessage.tool_calls) {
        try {
          this.logger.log(`Invoking tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}`);
          
          if (toolCall.name === searchTool.name) {
            const result = await searchTool.invoke(toolCall.args as z.infer<typeof searchTool.schema>);
            generatedMessages.push(new ToolMessage({ content: JSON.stringify(result), tool_call_id: toolCall.id!, name: toolCall.name }));

            if (result && Array.isArray(result.results) && result.results.length > 0) {
              const inferencePrompt = `Original query: "${originalQuery}"\n\nSearch results:\n${JSON.stringify(result.results.slice(0,3))}\n\nBased on the query, if any URLs look like an authoritative source for time or weather (e.g., time.is, accuweather.com), respond with ONLY that URL. Otherwise, "none".`;
              const inferenceResponse = await model.invoke([new HumanMessage({ content: inferencePrompt })]);
              const inferredUrl = (inferenceResponse.content as string).trim();

              if (inferredUrl.toLowerCase().startsWith('http')) {
                this.logger.log(`Search enhancement: Found authoritative URL ${inferredUrl}, fetching content.`);
                const fetchResult = await WebsiteFetchTool.func({ url: inferredUrl });
                generatedMessages.push(new HumanMessage({ content: `To give a better answer, I also fetched content from ${inferredUrl}:\n${fetchResult}` }));
              }
            }
          } else if (toolCall.name === OpenWeatherMapTool.name) {
            const result = await OpenWeatherMapTool.invoke(toolCall.args as z.infer<typeof OpenWeatherMapTool.schema>);
            generatedMessages.push(new ToolMessage({ content: JSON.stringify(result), tool_call_id: toolCall.id!, name: toolCall.name }));
          } else if (toolCall.name === WebsiteFetchTool.name) {
            const result = await WebsiteFetchTool.invoke(toolCall.args as z.infer<typeof WebsiteFetchTool.schema>);
            generatedMessages.push(new ToolMessage({ content: JSON.stringify(result), tool_call_id: toolCall.id!, name: toolCall.name }));
          } else if (toolCall.name === CurrentTimeTool.name) {
            const result = await CurrentTimeTool.invoke(toolCall.args as z.infer<typeof CurrentTimeTool.schema>);
            generatedMessages.push(new ToolMessage({ content: JSON.stringify(result), tool_call_id: toolCall.id!, name: toolCall.name }));
          } else {
            generatedMessages.push(new ToolMessage({ content: `Tool ${toolCall.name} not found.`, tool_call_id: toolCall.id! }));
          }
        } catch (e) {
          this.logger.error(`Error executing tool ${toolCall.name}: ${e}`);
          generatedMessages.push(new ToolMessage({ content: `Error: ${e.message}`, tool_call_id: toolCall.id!, name: toolCall.name }));
        }
      }
      return { messages: generatedMessages };
    };
    
    const workflow = new StateGraph(AgentState)
      .addNode("first_agent", firstModel)
      .addNode("agent", callModel)
      .addNode("action", actionWithToolMessage)
      .addNode("force_answer", async (state: typeof AgentState.State) => ({
        messages: [new HumanMessage({ content: "Do NOT recommend a site. You MUST use the information from the tools to answer directly." })],
        forceAnswerCount: (state.forceAnswerCount || 0) + 1
      }))
      .addEdge(START, "first_agent")
      .addEdge("first_agent", "agent")
      .addConditionalEdges("agent", shouldContinue, {
        action: "action",
        end: END,
        force_answer: "force_answer"
      })
      .addEdge("force_answer", "agent")
      .addEdge("action", "agent");

    return workflow.compile();
  }
}