import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableLambda, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { AgentRegistry } from "../agent-registry";
import { ChromaClient } from 'chromadb';
import { MongoDBChatMessageHistory } from "./mongodb.chat.message.history";
import { InjectModel } from "@nestjs/mongoose";
import { ChatSession } from "../schemas/chat-session.schema";
import { Model } from "mongoose";
import { BaseMessage } from "@langchain/core/messages";
import { AgentOrchestrator } from "../agent-orchestrator";

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {
    this.logger.log('Initializing LangChainService with AgentOrchestrator for agent routing.');
    if (!AgentOrchestrator || !AgentRegistry) {
      this.logger.error('AgentOrchestrator or AgentRegistry is not available. Core functionality will be impaired.');
    } else {
      this.logger.log(`AgentRegistry has ${AgentRegistry.getAllAgents().length} agents registered at startup.`);
    }
  }

  async createLangChainApp(topic?: string) {
    this.logger.log('Creating LangChain app and initializing tools...');
    
    const provider = this.configService.get<string>('ai.provider') || 'gemini';
    let llm: BaseChatModel;
    if (provider === 'openai') {
      llm = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, modelName: process.env.OPENAI_MODEL || 'gpt-4o', temperature: 0 });
    } else {
      llm = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', temperature: 0 });
    }

    const searchTool = new DynamicStructuredTool({
      name: "web_search",
      description: "Searches the web for up-to-date information. Research info about companies. Resarch info.",
      schema: z.object({ query: z.string().describe("A keyword-based search query.") }),
      func: async ({ query }) => { try { return await new TavilySearch().invoke({ query }); } catch (e) { this.logger.error(`Tavily search failed for query: ${query}`, e.stack); return "Search failed."; } },
    });

    const chromaTool = new DynamicStructuredTool({
      name: "document_search_tool",
      description: "Searches through uploaded documents to find relevant content. This tool retrieves raw document content that should be analyzed and interpreted by the LLM.",
      schema: z.object({ question: z.string().describe("A question about the user's uploaded document, PDF, or file.") }),
      func: async ({ question }, config) => {
        const extractQuestionKeywords = (question: string): string[] => {
          const questionLower = question.toLowerCase();
          const keywords: string[] = [];
          const articleRefs = questionLower.match(/artículo\s+\d+|article\s+\d+/g);
          if (articleRefs) {
            keywords.push(...articleRefs);
          }
          const importantWords = questionLower
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => 
              word.length > 3 && 
              !['what', 'como', 'donde', 'cuando', 'porque', 'cual', 'quien', 'dice', 'trata', 'contiene', 'sobre', 'acerca'].includes(word)
            );
          keywords.push(...importantWords);
          if (questionLower.includes('constitución') || questionLower.includes('constitution')) {
            keywords.push('constitución', 'constitution');
          }
          return [...new Set(keywords)];
        };

        const getContentTypeBoost = (contentType: string, question: string): number => {
          const questionLower = question.toLowerCase();
          if ((questionLower.includes('artículo') || questionLower.includes('article')) && contentType === 'article') {
            return 0.2;
          }
          if ((questionLower.includes('definición') || questionLower.includes('definition') || questionLower.includes('qué es')) && contentType === 'definition') {
            return 0.15;
          }
          if ((questionLower.includes('procedimiento') || questionLower.includes('cómo') || questionLower.includes('proceso')) && contentType === 'procedure') {
            return 0.15;
          }
          if ((questionLower.includes('trata') || questionLower.includes('sobre') || questionLower.includes('resumen')) && contentType === 'header') {
            return 0.1;
          }
          return 0;
        };

        const getStructureBoost = (metadata: any, docLower: string): number => {
          let boost = 0;
          if (metadata.startsWithHeader) {
            boost += 0.1;
          }
          if (metadata.hasArticleReference) {
            boost += 0.1;
          }
          if (metadata.hasNumbers) {
            boost += 0.05;
          }
          return boost;
        };

        const getLengthBoost = (length: number): number => {
          if (length >= 800 && length <= 2000) {
            return 0.1;
          }
          if (length >= 500 && length < 800) {
            return 0.05;
          }
          if (length < 200) {
            return -0.1;
          }
          return 0;
        };

        let sessionId = (config as any)?.metadata?.sessionId || (config as any)?.configurable?.sessionId || (config as any)?.userId;
        if (!sessionId) return "No session ID provided.";
        
        let queryEmbedding;
        try {
          const { GoogleGenerativeAIEmbeddings } = await import('@langchain/google-genai');
          const embedder = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY });
          [queryEmbedding] = await embedder.embedDocuments([question]);
        } catch (error) {
          console.warn('Failed to embed query, using fallback search:', error.message);
          queryEmbedding = null;
        }
        
        const keywords = question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !['que', 'qué', 'del', 'los', 'las', 'una', 'and', 'the', 'for', 'with'].includes(word));
        const chromaUrl = process.env.CHROMA_URL || "";
        const logger = this.logger || console;
        let host = '';
        let port = 8000;
        let ssl = false;
        try {
          const url = new URL(chromaUrl);
          host = url.hostname;
          port = Number(url.port) || 8000;
          ssl = false;
        } catch (err) {
          logger.error?.(`Failed to parse CHROMA_URL: ${chromaUrl}`, err);
        }
        const chroma = new ChromaClient({ host, port, ssl });
        const collectionName = `user_${sessionId}`;
        let collection;
        
        try {
          collection = await chroma.getOrCreateCollection({ name: collectionName, embeddingFunction: undefined });
        } catch (error) {
          console.warn('Failed to create ChromaDB collection, using fallback:', error.message);
          return "No documents found (ChromaDB not available in test environment).";
        }
        
        const questionKeywords = extractQuestionKeywords(question);
        const semanticNResults = 20;
        let semanticResults;
        
        if (queryEmbedding) {
          semanticResults = await collection.query({ queryEmbeddings: [queryEmbedding], nResults: semanticNResults, include: ["metadatas", "documents", "distances"] });
        } else {
          const keywordQuery = questionKeywords.join(' ');
          semanticResults = await collection.query({ queryTexts: [keywordQuery], nResults: semanticNResults, include: ["metadatas", "documents", "distances"] });
        }
        
        let allDocs = semanticResults.documents?.[0] || [];
        let allMetadatas = semanticResults.metadatas?.[0] || [];
        let allDistances = semanticResults.distances?.[0] || [];

        const hybridResults = allDocs.map((doc, i) => {
          const metadata = allMetadatas[i] || {};
          let score = allDistances[i] || 1.0;
          const docLower = (doc || '').toLowerCase();
          
          const keywordMatches = questionKeywords.filter(keyword => docLower.includes(keyword.toLowerCase())).length;
          if (keywordMatches > 0) {
            score = score * (1 - (keywordMatches * 0.15));
          }
          
          const contentTypeBoost = getContentTypeBoost(metadata.contentType as string || 'general', question);
          score = score * (1 - contentTypeBoost);
          
          const keyTerms = typeof metadata.keyTerms === 'string' ? metadata.keyTerms.split(',').filter(term => term.trim()) : [];
          const keyTermMatches = keyTerms.filter(term => questionKeywords.some(qk => qk.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(qk.toLowerCase()))).length;
          if (keyTermMatches > 0) {
            score = score * (1 - (keyTermMatches * 0.1));
          }
          
          const structureBoost = getStructureBoost(metadata, docLower);
          score = score * (1 - structureBoost);
          
          const lengthBoost = getLengthBoost(doc?.length || 0);
          score = score * (1 - lengthBoost);
          
          return { doc, metadata, distance: Math.max(0, score) };
        });
        
        if (!hybridResults.length) return "No relevant information found in your uploaded document.";
        
        hybridResults.sort((a, b) => a.distance - b.distance);
        const topResults = hybridResults.slice(0, 10);
        
        let context = topResults.map(result => (result.doc ?? '').trim()).join("\n\n");
        
        if (context.trim()) {
          return context;
        } else {
          return "No relevant information found in your uploaded document.";
        }
      },
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
        if (!location || location.trim().length === 0) {
          return "Please provide a valid location to check the weather.";
        }
        
        const extractLocationWithLLM = async (input: string): Promise<string> => {
          const extractionPrompt = `You are a location extraction assistant. Your task is to extract city/location names from weather-related queries and format them properly for OpenWeatherMap API.

RULES:
1. If query compares multiple locations (words like "compara", "compare", "vs", "versus", "con el de"), return locations separated by " | "
2. For single location, extract ONLY the city/location name from the query
3. Format as "City, Country" when possible (e.g., "Santo Domingo, DO", "New York, US")
4. Use standard country codes (US, DO, ES, FR, JP, PH, etc.)
5. If no country is specified, return just the city name
6. Remove ALL question words, weather terms, and extra text
7. Return ONLY the location(s), nothing else

Query: "${input}"
Location(s):`;

          try {
            const extractionResult = await llm.invoke(extractionPrompt);
            return typeof extractionResult.content === 'string' ? extractionResult.content.trim() : extractionResult.content.toString().trim();
          } catch (error) {
            this.logger.error(`Error using LLM for location extraction: ${error.message}`);
            return input.replace(/^(como\s+esta\s+el\s+clima\s+en\s+|what(?:'s|\s+is)\s+the\s+weather\s+(?:like\s+)?(?:in\s+|at\s+|for\s+)|weather\s+(?:in\s+|at\s+|for\s+)|clima\s+en\s+|tiempo\s+en\s+)/i, '').replace(/\?/g, '').trim();
          }
        };
        
        const cleanLocation = await extractLocationWithLLM(location);
        
        if (cleanLocation.includes(' | ')) {
          const locations = cleanLocation.split(' | ').map(loc => loc.trim());
          const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
          if (!apiKey) return "OpenWeatherMap API key is missing.";
          
          const fetchSingleLocationWeather = async (singleLocation: string): Promise<string> => {
            try {
              const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(singleLocation)}&limit=1&appid=${apiKey}`;
              const geoRes = await fetch(geoUrl);
              if (!geoRes.ok) throw new Error(`Geocoding API error: HTTP ${geoRes.status}`);
              const geoData = await geoRes.json();
              if (!geoData || geoData.length === 0) throw new Error(`Could not find location data for ${singleLocation}`);
              
              const { lat, lon, name, country } = geoData[0];
              const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
              const weatherRes = await fetch(weatherUrl);
              if (!weatherRes.ok) throw new Error(`Weather API error: HTTP ${weatherRes.status}`);
              
              const weatherData = await weatherRes.json();
              const { temp, feels_like, humidity } = weatherData.main;
              const description = weatherData.weather[0].description;
              const windSpeed = weatherData.wind?.speed || 'N/A';
              
              return `${name}, ${country}: ${description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%. Wind: ${windSpeed} m/s.`;
            } catch (error) {
              return `Could not get weather for ${singleLocation}: ${error.message}`;
            }
          };
          
          const weatherResults = await Promise.all(locations.map(fetchSingleLocationWeather));
          const isSpanish = location.toLowerCase().includes('compara') || location.toLowerCase().includes('clima');
          return isSpanish ? `Comparación del clima:\n\n${weatherResults.join('\n\n')}` : `Weather comparison:\n\n${weatherResults.join('\n\n')}`;
        }
        
        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        if (!apiKey) return "OpenWeatherMap API key is missing.";
        
        try {
          const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanLocation)}&limit=1&appid=${apiKey}`;
          const geoRes = await fetch(geoUrl);
          if (!geoRes.ok) return `Could not find location data for ${cleanLocation}. API returned error ${geoRes.status}.`;
          
          const geoData = await geoRes.json();
          if (!geoData || geoData.length === 0) return `Could not find location data for ${cleanLocation}. Please try with a more specific location.`;
          
          const { lat, lon, name, country } = geoData[0];
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
          const weatherRes = await fetch(weatherUrl);
          if (!weatherRes.ok) return `Failed to fetch weather. API returned error ${weatherRes.status}.`;
          
          const weatherData = await weatherRes.json();
          const { temp, feels_like, humidity } = weatherData.main;
          const description = weatherData.weather[0].description;
          const windSpeed = weatherData.wind?.speed || 'N/A';
          
          return `Current weather in ${name}, ${country}: ${description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%. Wind speed: ${windSpeed} m/s.`;
        } catch (error) { 
          return `An error occurred while fetching weather for ${cleanLocation}. Please try again with a more specific location.`; 
        }
      },
    });

    if (!AgentRegistry.getAgent('web_search')) {
      AgentRegistry.register({
        name: 'web_search',
        description: searchTool.description,
        handle: async (input, context) => ({ output: await searchTool.func({ query: input }, context), confidence: 0.8 })
      });
    }
    if (!AgentRegistry.getAgent('document_search_tool')) {
      AgentRegistry.register({
        name: 'document_search_tool',
        description: chromaTool.description,
        handle: async (input, context) => ({ output: await chromaTool.func({ question: input }, context), confidence: 0.8 })
      });
    }
    if (!AgentRegistry.getAgent('current_time')) {
      AgentRegistry.register({
        name: 'current_time',
        description: currentTimeTool.description,
        handle: async (input, context) => ({ output: await currentTimeTool.func({ timezone: input }, context), confidence: 0.95 })
      });
    }
    if (!AgentRegistry.getAgent('open_weather_map')) {
      AgentRegistry.register({
        name: 'open_weather_map',
        description: openWeatherMapTool.description,
        handle: async (input, context) => ({ output: await openWeatherMapTool.func({ location: input }, context), confidence: 0.95 })
      });
    }

    const finalRunnable = new RunnableLambda({
      func: async (input: { input: string; chat_history: BaseMessage[] }, config?: any) => {
        const sessionId = (config as any)?.configurable?.sessionId || (config as any)?.metadata?.sessionId || (config as any)?.userId;
        
        if (!sessionId) {
          this.logger.warn('No session ID found in context, message history may not work properly');
        }

        const agentContext = {
          userId: sessionId,
          sessionId: sessionId,
          chatHistory: input.chat_history,
          llm,
          configurable: { ...(config?.configurable || {}), sessionId },
          metadata: { ...(config?.metadata || {}), sessionId },
          ...config
        };
        
        const allRegisteredAgents = AgentRegistry.getAllAgents().map(agent => agent.name);
        this.logger.log(`Routing among agents: ${allRegisteredAgents.join(', ')}`);
        
        const routingResult = await AgentOrchestrator.routeByConfidence(
          allRegisteredAgents, 
          input.input, 
          agentContext
        );
        
        this.logger.log(`AgentOrchestrator selected '${routingResult.agent}' with confidence ${routingResult.result.confidence}`);
        return { output: routingResult.result.output };
      }
    });

    const agentWithHistory = new RunnableWithMessageHistory({
      runnable: finalRunnable,
      getMessageHistory: (sessionId: string) => {
        this.logger.log(`Creating message history for session: ${sessionId}`);
        if (!sessionId || sessionId.length < 3) {
          this.logger.error(`Invalid session ID provided to getMessageHistory: "${sessionId}"`);
          throw new Error(`Invalid session ID provided to message history: "${sessionId}"`);
        }
        return new MongoDBChatMessageHistory(this.chatSessionModel, sessionId);
      },
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "output"
    });

    this.logger.log(`Langchain app created successfully, relying on AgentOrchestrator for routing.`);
    return agentWithHistory;
  }
}
