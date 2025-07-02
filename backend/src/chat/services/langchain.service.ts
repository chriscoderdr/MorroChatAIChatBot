import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TavilySearch } from '@langchain/tavily';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { AgentRegistry } from '../agent-registry';
import { ChromaClient } from 'chromadb';
import { MongoDBChatMessageHistory } from './mongodb.chat.message.history';
import { InjectModel } from '@nestjs/mongoose';
import { ChatSession } from '../schemas/chat-session.schema';
import { Model } from 'mongoose';
import { BaseMessage } from '@langchain/core/messages';
import { AgentOrchestrator } from '../agent-orchestrator';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
    private readonly llmService: LlmService,
  ) {
    this.logger.log(
      'Initializing LangChainService with AgentOrchestrator for agent routing.',
    );
    if (!AgentOrchestrator || !AgentRegistry) {
      this.logger.error(
        'AgentOrchestrator or AgentRegistry is not available. Core functionality will be impaired.',
      );
    } else {
      this.logger.log(
        `AgentRegistry has ${AgentRegistry.getAllAgents().length} agents registered at startup.`,
      );
    }
  }

  async createLangChainApp(topic?: string) {
    this.logger.log('Creating LangChain app and initializing tools...');

    const llm = this.llmService.getLlm();

    const searchTool = new DynamicStructuredTool({
      name: 'web_search',
      description:
        'Searches the web for up-to-date information. Research info about companies. Resarch info.',
      schema: z.object({
        query: z.string().describe('A keyword-based search query.'),
      }),
      func: async ({ query }) => {
        try {
          const tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY');
          if (!tavilyApiKey) {
            this.logger.error('Tavily API key is not configured.');
            return 'Search failed due to missing API key.';
          }
          const tavilySearch = new TavilySearch({ tavilyApiKey });
          return await tavilySearch.invoke({ query });
        } catch (e) {
          this.logger.error(
            `Tavily search failed for query: ${query}`,
            e.stack,
          );
          return 'Search failed.';
        }
      },
    });

    const currentTimeTool = new DynamicStructuredTool({
      name: 'current_time',
      description:
        'Gets the current date and time for a specific IANA timezone.',
      schema: z.object({
        timezone: z
          .string()
          .describe(
            "A valid IANA timezone name, e.g., 'America/Santo_Domingo'.",
          ),
      }),
      func: async ({ timezone }) => {
        try {
          return new Date().toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          });
        } catch (e) {
          return `Failed to get time. '${timezone}' is not a valid IANA timezone.`;
        }
      },
    });

    const openWeatherMapTool = new DynamicStructuredTool({
      name: 'open_weather_map',
      description: 'Provides the current weather for a single, specific city.',
      schema: z.object({
        location: z
          .string()
          .describe("The city and country, e.g., 'Santo Domingo, DO'."),
      }),
      func: async ({ location }: { location: string }) => {
        if (!location || location.trim().length === 0) {
          return 'Please provide a valid location to check the weather.';
        }

        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        if (!apiKey) return 'OpenWeatherMap API key is missing.';

        try {
          const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
          const geoRes = await fetch(geoUrl);
          if (!geoRes.ok)
            return `Could not find location data for ${location}. API returned error ${geoRes.status}.`;

          const geoData = await geoRes.json();
          if (!geoData || geoData.length === 0)
            return `Could not find location data for ${location}. Please try with a more specific location.`;

          const { lat, lon, name, country } = geoData[0];
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
          const weatherRes = await fetch(weatherUrl);
          if (!weatherRes.ok)
            return `Failed to fetch weather. API returned error ${weatherRes.status}.`;

          const weatherData = await weatherRes.json();
          const { temp, feels_like, humidity } = weatherData.main;
          const description = weatherData.weather[0].description;
          const windSpeed = weatherData.wind?.speed || 'N/A';

          return `Current weather in ${name}, ${country}: ${description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%. Wind speed: ${windSpeed} m/s.`;
        } catch (error) {
          return `An error occurred while fetching weather for ${location}. Please try again with a more specific location.`;
        }
      },
    });

    if (!AgentRegistry.getAgent('web_search')) {
      AgentRegistry.register({
        name: 'web_search',
        description: searchTool.description,
        handle: async (input, _context) => ({
          output: await searchTool.func({ query: input }),
          confidence: 0.8,
        }),
      });
    }
    if (!AgentRegistry.getAgent('current_time')) {
      AgentRegistry.register({
        name: 'current_time',
        description: currentTimeTool.description,
        handle: async (input, _context) => ({
          output: await currentTimeTool.func({ timezone: input }),
          confidence: 0.95,
        }),
      });
    }
    if (!AgentRegistry.getAgent('open_weather_map')) {
      AgentRegistry.register({
        name: 'open_weather_map',
        description: openWeatherMapTool.description,
        handle: async (input, _context) => ({
          output: await openWeatherMapTool.func({ location: input }),
          confidence: 0.95,
        }),
      });
    }


    const finalRunnable = new RunnableLambda({
      func: async (
        input: { input: string; chat_history: BaseMessage[] },
        config?: any,
      ) => {
        const sessionId =
          config?.configurable?.sessionId ||
          config?.metadata?.sessionId ||
          config?.userId;

        if (!sessionId) {
          this.logger.warn(
            'No session ID found in context, message history may not work properly',
          );
        }

        const agentContext = {
          userId: sessionId,
          sessionId: sessionId,
          chatHistory: input.chat_history,
          llm,
          geminiApiKey: this.configService.get<string>('GEMINI_API_KEY'),
          configurable: { ...(config?.configurable || {}), sessionId },
          metadata: { ...(config?.metadata || {}), sessionId },
          ...config,
        };

        const allRegisteredAgents = AgentRegistry.getAllAgents().map(
          (agent) => agent.name,
        );
        this.logger.log(
          `Routing among agents: ${allRegisteredAgents.join(', ')}`,
        );

        const routingResult = await AgentOrchestrator.routeByConfidence(
          allRegisteredAgents,
          input.input,
          agentContext,
        );

        this.logger.log(
          `AgentOrchestrator selected '${routingResult.agent}' with confidence ${routingResult.result.confidence}`,
        );
        return { output: routingResult.result.output };
      },
    });

    const agentWithHistory = new RunnableWithMessageHistory({
      runnable: finalRunnable,
      getMessageHistory: (sessionId: string) => {
        this.logger.log(`Creating message history for session: ${sessionId}`);
        if (!sessionId || sessionId.length < 3) {
          this.logger.error(
            `Invalid session ID provided to getMessageHistory: "${sessionId}"`,
          );
          throw new Error(
            `Invalid session ID provided to message history: "${sessionId}"`,
          );
        }
        return new MongoDBChatMessageHistory(this.chatSessionModel, sessionId);
      },
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
      outputMessagesKey: 'output',
    });

    this.logger.log(
      `Langchain app created successfully, relying on AgentOrchestrator for routing.`,
    );
    return agentWithHistory;
  }
}
