import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { AgentRegistry } from '../agent-registry';
import { MongoDBChatMessageHistory } from './mongodb.chat.message.history';
import { InjectModel } from '@nestjs/mongoose';
import { ChatSession } from '../schemas/chat-session.schema';
import { Model } from 'mongoose';
import { BaseMessage } from '@langchain/core/messages';
import { AgentOrchestrator } from '../agent-orchestrator';
import { LlmService } from '../../llm/llm.service';
import { NastyScoreService } from './nasty-score.service';
import { NonsenseScoreService } from './nonsense-score.service';
import { ChatOpenAI } from '@langchain/openai';
import { createCalculatorTool } from '../tools/calculator.tool';
import { createCurrencyConverterTool } from '../tools/currency-converter.tool';
import { createCurrentTimeTool } from '../tools/current-time.tool';
import { createHashingTool } from '../tools/hashing.tool';
import { createOpenWeatherMapTool } from '../tools/open-weather-map.tool';
import { createSearchTool } from '../tools/search.tool';
import { createUnitConverterTool } from '../tools/unit-converter.tool';

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
    private readonly llmService: LlmService,
    private readonly nastyScoreService: NastyScoreService,
    private readonly nonsenseScoreService: NonsenseScoreService,
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

    const searchTool = createSearchTool(this.configService, this.logger);
    const currentTimeTool = createCurrentTimeTool();
    const openWeatherMapTool = createOpenWeatherMapTool(this.configService);
    const calculatorTool = createCalculatorTool(this.configService, this.logger);
    const unitConverterTool = createUnitConverterTool(
      this.configService,
      this.logger,
    );
    const hashingTool = createHashingTool(this.configService, this.logger);
    const currencyConverterTool = createCurrencyConverterTool(
      this.configService,
      this.logger,
    );

    if (!AgentRegistry.getAgent('search')) {
      AgentRegistry.register({
        name: 'search',
        description: searchTool.description,
        handle: async (input: string, _context) => {
          let query: string;
          let exclude_sites: string[] | undefined;

          try {
            const parsedInput = JSON.parse(input);
            if (
              typeof parsedInput === 'object' &&
              parsedInput !== null &&
              'query' in parsedInput
            ) {
              query = parsedInput.query;
              exclude_sites = parsedInput.exclude_sites;
            } else {
              // It's a valid JSON, but not the format we expect. Treat the original input as a plain query.
              query = input;
            }
          } catch (e) {
            // Not a JSON string, treat as a plain string query.
            query = input;
          }

          const rawOutput = await searchTool.invoke({ query, exclude_sites });
          try {
            // Try parsing as JSON, assuming SearxNG was used
            const results = JSON.parse(rawOutput);
            if (Array.isArray(results) && results.length > 0) {
              return {
                output: results
                  .map(
                    (r: any) =>
                      `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content || ''}`,
                  )
                  .join('\n\n'),
                confidence: 0.8,
              };
            } else if (results.error) {
              return { output: results.error, confidence: 0.8 };
            }
            return { output: 'No results found.', confidence: 0.8 };
          } catch (e) {
            // If parsing fails, it's likely from Brave or Tavily, which return a string.
            return { output: rawOutput, confidence: 0.8 };
          }
        },
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
    if (!AgentRegistry.getAgent('calculator')) {
      AgentRegistry.register({
        name: 'calculator',
        description: calculatorTool.description,
        handle: async (input, _context) => {
          // Strip out conversational words to get the raw expression
          const expression = input
            .replace(/(calculate|what is|what's|=|\?)/gi, '')
            .trim();
          return {
            output: await calculatorTool.invoke({ expression }),
            confidence: 0.98,
          };
        },
      });
    }
    if (!AgentRegistry.getAgent('unit_converter')) {
      AgentRegistry.register({
        name: 'unit_converter',
        description: unitConverterTool.description,
        handle: async (input, context) => {
          const llm = context.llm as ChatOpenAI;
          if (!llm) {
            return {
              output: 'Unit converter failed: LLM not available.',
              confidence: 0.1,
            };
          }
          // Use the LLM to rephrase the user's question into a direct query
          const prompt = `You are a highly intelligent query formatter. Your task is to convert a user's question about unit conversion into a direct, machine-readable query. The query must be in English and follow a format like "10kg to lb" or "5 miles in km". Respond with only the direct query itself, without any additional text or explanation.

User question: "${input}"

Direct query:`;
          const result = await llm.invoke(prompt);
          const directQuery = result.content.toString().trim();
          this.logger.debug(
            `Unit converter direct query: "${directQuery}"`,
          );
          return {
            output: await unitConverterTool.invoke({ query: directQuery }),
            confidence: 0.98,
          };
        },
      });
    }
    if (!AgentRegistry.getAgent('hashing')) {
      AgentRegistry.register({
        name: 'hashing',
        description: hashingTool.description,
        handle: async (input, _context) => {
          // A simple heuristic to parse "hash 'text' with algo"
          const match = input.match(/hash '(.+?)' with (.+)/i);
          if (match) {
            const [, text, algorithm] = match;
            return {
              output: await hashingTool.invoke({ text, algorithm }),
              confidence: 0.98,
            };
          }
          // Fallback for just text, default to sha256
          return {
            output: await hashingTool.invoke({
              text: input,
              algorithm: 'sha256',
            }),
            confidence: 0.9,
          };
        },
      });
    }
    if (!AgentRegistry.getAgent('currency_converter')) {
      AgentRegistry.register({
        name: 'currency_converter',
        description: currencyConverterTool.description,
        handle: async (input, context) => {
          const llm = context.llm as ChatOpenAI;
          if (!llm) {
            return {
              output: 'Currency converter failed: LLM not available.',
              confidence: 0.1,
            };
          }
          const prompt = `You are an expert query formatter. Convert the user's question about currency into a direct query for a search engine (e.g., "100 USD to EUR"). Respond with only the direct query.

User question: "${input}"

Direct query:`;
          const result = await llm.invoke(prompt);
          const directQuery = result.content.toString().trim();
          this.logger.debug(
            `Currency converter direct query: "${directQuery}"`,
          );
          return {
            output: await currencyConverterTool.invoke({ query: directQuery }),
            confidence: 0.98,
          };
        },
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
          nastyScoreService: this.nastyScoreService,
          nonsenseScoreService: this.nonsenseScoreService,
          geminiApiKey: this.configService.get<string>('GEMINI_API_KEY'),
          chatDefaultTopic: this.configService.get<string>('app.chatDefaultTopic'),
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
