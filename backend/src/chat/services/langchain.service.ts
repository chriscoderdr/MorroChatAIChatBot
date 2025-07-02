import { BraveSearch } from '@langchain/community/tools/brave_search';
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
import { ChatOpenAI } from '@langchain/openai';

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
      name: 'search',
      description:
        'Searches the web for up-to-date information using a configurable search engine. Supports complex queries including site exclusions.',
      schema: z.object({
        query: z.string().describe('The main search query.'),
        exclude_sites: z
          .array(z.string())
          .optional()
          .describe(
            'A list of domains to exclude from the search (e.g., ["rt.com", "sputniknews.com"]).',
          ),
      }),
      func: async ({ query, exclude_sites }) => {
        let fullQuery = query;
        if (exclude_sites && exclude_sites.length > 0) {
          const exclusionString = exclude_sites
            .map((site) => `-site:${site}`)
            .join(' ');
          fullQuery = `${query} ${exclusionString}`;
        }

        const searxngBaseUrl =
          this.configService.get<string>('SEARXNG_BASE_URL') ||
          'http://localhost:8888';
        const braveApiKey = this.configService.get<string>('BRAVE_API_KEY');
        const tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY');

        // Priority: SearxNG -> Brave -> Tavily -> Public SearxNG fallback
        if (searxngBaseUrl) {
          this.logger.log(`Using SearxNG for web search with query: ${fullQuery}`);
          const url = new URL(searxngBaseUrl);
          url.searchParams.append('q', fullQuery);
          url.searchParams.append('format', 'json');
          try {
            const response = await fetch(url.toString(), {
              headers: {
                Accept: 'application/json',
              },
            });
            if (!response.ok) {
              const errorBody = await response.text();
              this.logger.error(
                `SearxNG request failed with status ${response.status} for query: ${fullQuery}. Body: ${errorBody}`,
              );
              return JSON.stringify({
                error: `Search failed: The search engine returned an error (status ${response.status}).`,
              });
            }
            const responseText = await response.text();
            try {
              const json = JSON.parse(responseText);
              return JSON.stringify(json.results || []);
            } catch (e) {
              this.logger.error(
                `SearxNG returned non-JSON response for query: "${fullQuery}".\nRESPONSE BODY:\n${responseText}`,
              );
              return JSON.stringify({
                error:
                  'Search failed: The search engine returned an invalid response (not JSON).',
              });
            }
          } catch (e) {
            this.logger.error(
              `SearxNG search failed for query: ${fullQuery}`,
              e.stack,
            );
            return JSON.stringify({ error: 'Search failed.' });
          }
        } else if (braveApiKey) {
          this.logger.log(`Using Brave for web search with query: ${fullQuery}`);
          try {
            const brave = new BraveSearch({ apiKey: braveApiKey });
            const results = await brave.invoke(fullQuery);
            return results; // Brave returns a string, which is fine
          } catch (e) {
            this.logger.error(
              'Brave search failed, falling back to SearxNG',
              e.stack,
            );
          }
        } else if (tavilyApiKey) {
          this.logger.log(`Using Tavily for web search with query: ${fullQuery}`);
          try {
            const tavily = new TavilySearch({ tavilyApiKey });
            const results = await tavily.invoke({ query: fullQuery });
            // Check for Tavily's specific rate limit error in the response
            if (typeof results === 'string' && results.includes('rate limit')) {
              this.logger.warn(
                'Tavily search hit a rate limit, falling back to SearxNG',
              );
            } else {
              return results; // Tavily also returns a string
            }
          } catch (e) {
            this.logger.error(
              'Tavily search failed, falling back to SearxNG',
              e.stack,
            );
          }
        }

        // Fallback to public SearxNG
        this.logger.log(
          `No search provider configured or primary search failed, defaulting to public SearxNG instance with query: ${fullQuery}`,
        );
        const fallbackUrl = 'https://searx.info/';
        const url = new URL(fallbackUrl);
        url.searchParams.append('q', fullQuery);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            const errorBody = await response.text();
            this.logger.error(
              `Fallback SearxNG request failed with status ${response.status} for query: ${fullQuery}. Body: ${errorBody}`,
            );
            return JSON.stringify({
              error: `Search failed: The fallback search engine returned an error (status ${response.status}).`,
            });
          }
          const responseText = await response.text();
          try {
            const json = JSON.parse(responseText);
            return JSON.stringify(json.results || []);
          } catch (e) {
            this.logger.error(
              `Fallback SearxNG returned non-JSON response for query: "${fullQuery}".\nRESPONSE BODY:\n${responseText}`,
            );
            return JSON.stringify({
              error:
                'Search failed: The fallback search engine returned an invalid response (not JSON).',
            });
          }
        } catch (e) {
          this.logger.error(
            `Fallback SearxNG search failed for query: ${fullQuery}`,
            e.stack,
          );
          return JSON.stringify({ error: 'Search failed.' });
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
          const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
            location,
          )}&limit=1&appid=${apiKey}`;
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

    const calculatorTool = new DynamicStructuredTool({
      name: 'calculator',
      description:
        'Calculates mathematical expressions. Use for questions involving arithmetic.',
      schema: z.object({
        expression: z
          .string()
          .describe('The mathematical expression to evaluate, e.g., "2+2".'),
      }),
      func: async ({ expression }) => {
        const searxngBaseUrl =
          this.configService.get<string>('SEARXNG_BASE_URL') ||
          'http://localhost:8888';
        if (!searxngBaseUrl) {
          return 'Calculator functionality is not available (SearxNG not configured).';
        }
        const url = new URL(searxngBaseUrl);
        url.searchParams.append('q', expression);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
          });
          const json = await response.json();
          this.logger.debug(
            `Calculator SearXNG response for "${expression}": ${JSON.stringify(
              json,
              null,
              2,
            )}`,
          );
          const answer = json.answers?.find(
            (a: any) => a.engine === 'plugin: calculator',
          );
          if (answer) {
            const result = answer.answer.split('=');
            return `### 🧮 Calculator Result\n**Expression:** \`${
              result[0]
            }\`\n**Result:** \`${result[1]}\``;
          }
          return 'Could not calculate the expression.';
        } catch (e) {
          this.logger.error(`Calculator tool failed for: "${expression}"`, e);
          return 'Failed to get calculation result.';
        }
      },
    });

    const unitConverterTool = new DynamicStructuredTool({
      name: 'unit_converter',
      description: 'Converts between different units of measurement.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'The conversion query, e.g., "10kg to lb" or "5 miles in km".',
          ),
      }),
      func: async ({ query }) => {
        const searxngBaseUrl =
          this.configService.get<string>('SEARXNG_BASE_URL') ||
          'http://localhost:8888';
        if (!searxngBaseUrl) {
          return 'Unit conversion is not available (SearxNG not configured).';
        }
        const url = new URL(searxngBaseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
          });
          const json = await response.json();
          this.logger.debug(
            `Unit Converter SearXNG response for "${query}": ${JSON.stringify(
              json,
              null,
              2,
            )}`,
          );
          const answer = json.answers?.find(
            (a: any) => a.engine === 'plugin: unit_converter',
          );
          if (answer) {
            return `### 📏 Unit Conversion\n**Query:** \`${query}\`\n**Result:** \`${answer.answer}\``;
          }
          return 'Could not perform the unit conversion.';
        } catch (e) {
          this.logger.error(`Unit converter tool failed for: "${query}"`, e);
          return 'Failed to get conversion result.';
        }
      },
    });

    const hashingTool = new DynamicStructuredTool({
      name: 'hashing',
      description:
        'Hashes a string using a specified algorithm (e.g., sha256, md5).',
      schema: z.object({
        text: z.string().describe('The text to hash.'),
        algorithm: z
          .string()
          .describe('The hashing algorithm, e.g., "sha256", "md5".'),
      }),
      func: async ({ text, algorithm }) => {
        const searxngBaseUrl =
          this.configService.get<string>('SEARXNG_BASE_URL') ||
          'http://localhost:8888';
        if (!searxngBaseUrl) {
          return 'Hashing functionality is not available (SearxNG not configured).';
        }
        const query = `${algorithm} ${text}`;
        const url = new URL(searxngBaseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
              'X-Forwarded-For': '127.0.0.1',
              'X-Real-IP': '127.0.0.1',
            },
          });
          const json = await response.json();
          this.logger.debug(
            `Hashing SearXNG response for "${query}": ${JSON.stringify(
              json,
              null,
              2,
            )}`,
          );
          const answer = json.answers?.find(
            (a: any) => a.engine === 'plugin: hash_plugin',
          );
          if (answer) {
            const result = answer.answer.split('hash digest:');
            return `### 🔒 Hashing Result\n**Text:** \`${text}\`\n**Algorithm:** \`${algorithm}\`\n**Hash:** \`${
              result[1]
            }\``;
          }
          return `Could not compute ${algorithm} hash.`;
        } catch (e) {
          this.logger.error(`Hashing tool failed for: "${query}"`, e);
          return 'Failed to get hash result.';
        }
      },
    });

    const currencyConverterTool = new DynamicStructuredTool({
      name: 'currency_converter',
      description: 'Converts between different currencies.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'The currency conversion query, e.g., "100 USD to EUR".',
          ),
      }),
      func: async ({ query }) => {
        const searxngBaseUrl =
          this.configService.get<string>('SEARXNG_BASE_URL') ||
          'http://localhost:8888';
        if (!searxngBaseUrl) {
          return 'Currency conversion is not available (SearxNG not configured).';
        }
        const url = new URL(searxngBaseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
          });
          const json = await response.json();
          this.logger.debug(
            `Currency Converter SearXNG response for "${query}": ${JSON.stringify(
              json,
              null,
              2,
            )}`,
          );
          const answer = json.answers?.find(
            (a: any) => a.engine === 'currency',
          );
          if (answer) {
            return `### 💰 Currency Conversion\n**Query:** \`${query}\`\n**Result:** \`${answer.answer}\``;
          }
          return 'Could not perform the currency conversion.';
        } catch (e) {
          this.logger.error(`Currency converter tool failed for: "${query}"`, e);
          return 'Failed to get currency conversion result.';
        }
      },
    });

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
