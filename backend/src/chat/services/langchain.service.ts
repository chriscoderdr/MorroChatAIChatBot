import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableLambda, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { TIME_AGENT_PROMPT, WEATHER_AGENT_PROMPT, GENERAL_AGENT_PROMPT, DOCUMENT_AGENT_PROMPT, RESEARCH_AGENT_PROMPT } from "../prompts/agent-prompts";
import { AgentRegistry, AgentHandler } from "../agent-registry";
import { ChromaClient } from 'chromadb';
import { MongoDBChatMessageHistory } from "./mongodb.chat.message.history";
import { InjectModel } from "@nestjs/mongoose";
import { ChatSession } from "../schemas/chat-session.schema";
import { Model } from "mongoose";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { BaseMessage } from "@langchain/core/messages";
import { AgentOrchestrator } from "../agent-orchestrator";

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {
    // Initialize and register built-in agents immediately
    this.initializeBuiltInAgents();
    
    // Log that we're using AgentOrchestrator for consistent message history
    this.logger.log('Initializing LangChainService with AgentOrchestrator for consistent message history');
    
    // Validate that AgentOrchestrator and AgentRegistry are properly loaded
    if (!AgentOrchestrator) {
      this.logger.error('AgentOrchestrator is not available - message history may not work properly');
    } else {
      this.logger.log('AgentOrchestrator is available and will be used for agent routing');
    }
    
    if (!AgentRegistry) {
      this.logger.error('AgentRegistry is not available - agent plugins may not work properly');
    } else {
      this.logger.log(`AgentRegistry has ${AgentRegistry.getAllAgents().length} agents registered`);
    }
  }

  private async initializeBuiltInAgents() {
    // Initialize the langchain app once to register all built-in agents
    try {
      await this.createLangChainApp();
    } catch (error) {
      this.logger.error('Failed to initialize built-in agents', error);
    }
  }

  async createLangChainApp(topic?: string) {
    this.logger.log('Creating LangChain app and initializing all required agents...');
    
    // Check the current state of agent registry
    const registeredAgents = AgentRegistry.getAllAgents().map(a => a.name);
    this.logger.log(`Currently registered agents: ${registeredAgents.join(', ') || 'none'}`);
    
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

    // ChromaDB document retrieval tool
    const chromaTool = new DynamicStructuredTool({
      name: "document_search",
      description: "Use this tool for ANY question about the user's uploaded PDF, document, or file, including questions like: 'What is the main topic of the PDF I uploaded?', 'Summarize my document', 'What does my file say about X?', 'What is the summary of the uploaded file?', 'What are the key points in my document?', 'What is the uploaded PDF about?', 'What topics are covered in my file?', 'según el documento', 'segun el documento', 'en el documento', 'el documento dice', 'menciona el documento', 'de acuerdo al documento', etc. Use this tool whenever the user refers to 'the PDF I uploaded', 'my document', 'uploaded file', 'the file', 'según el documento', 'segun el documento', 'en el documento', or similar phrases, even if the question is not directly about the file name.",
      schema: z.object({ question: z.string().describe("A question about the user's uploaded document, PDF, or file.") }),
      func: async ({ question }, config) => {
        // Extract sessionId from config - check multiple possible locations
        let sessionId = (config as any)?.metadata?.sessionId || 
                       (config as any)?.configurable?.sessionId ||
                       (config as any)?.userId ||
                       (config as any)?.configurable?.userId;
        if (!sessionId) return "No session ID provided.";
        
        // Embed the question
        const embedder = new (require('@langchain/google-genai').GoogleGenerativeAIEmbeddings)({ apiKey: process.env.GEMINI_API_KEY });
        const [queryEmbedding] = await embedder.embedDocuments([question]);
        
        // Extract keywords from the question for hybrid search
        const keywords = question.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2 && !['que', 'qué', 'del', 'los', 'las', 'una', 'and', 'the', 'for', 'with'].includes(word));
        // Query ChromaDB for this user (parse CHROMA_URL like PdfVectorService)
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
        const collection = await chroma.getOrCreateCollection({ name: collectionName });
        
        // Extract question keywords for hybrid search
        const questionKeywords = this.extractQuestionKeywords(question);
        console.log(`chromaTool: Question keywords:`, questionKeywords);
        
        // Perform semantic search
        const semanticNResults = 20; // Increased for better coverage
        const semanticResults = await collection.query({ queryEmbeddings: [queryEmbedding], nResults: semanticNResults, include: ["metadatas", "documents", "distances"] });
        
        // Perform advanced hybrid ranking
        let allDocs = semanticResults.documents?.[0] || [];
        let allMetadatas = semanticResults.metadatas?.[0] || [];
        let allDistances = semanticResults.distances?.[0] || [];

        console.log(`chromaTool: Query results:`, JSON.stringify({
          docsCount: allDocs.length,
          firstDoc: allDocs[0]?.substring(0, 100) + '...',
          distances: allDistances.slice(0, 5)
        }, null, 2));
        
        // Advanced scoring with multiple factors
        const hybridResults = allDocs.map((doc, i) => {
          const metadata = allMetadatas[i] || {};
          let score = allDistances[i] || 1.0;
          const docLower = (doc || '').toLowerCase();
          
          // Factor 1: Keyword matching boost
          const keywordMatches = questionKeywords.filter(keyword => 
            docLower.includes(keyword.toLowerCase())
          ).length;
          if (keywordMatches > 0) {
            score = score * (1 - (keywordMatches * 0.15)); // Up to 45% boost for 3+ keywords
          }
          
          // Factor 2: Content type relevance
          const contentTypeBoost = this.getContentTypeBoost(metadata.contentType as string || 'general', question);
          score = score * (1 - contentTypeBoost);
          
          // Factor 3: Key terms matching
          const keyTerms = typeof metadata.keyTerms === 'string' ? 
            metadata.keyTerms.split(',').filter(term => term.trim()) : [];
          const keyTermMatches = keyTerms.filter(term => 
            questionKeywords.some(qk => qk.toLowerCase().includes(term.toLowerCase()) || 
                                      term.toLowerCase().includes(qk.toLowerCase()))
          ).length;
          if (keyTermMatches > 0) {
            score = score * (1 - (keyTermMatches * 0.1)); // Additional boost for key terms
          }
          
          // Factor 4: Document structure preference
          const structureBoost = this.getStructureBoost(metadata, docLower);
          score = score * (1 - structureBoost);
          
          // Factor 5: Content length preference (medium-length chunks often contain complete thoughts)
          const lengthBoost = this.getLengthBoost(doc?.length || 0);
          score = score * (1 - lengthBoost);
          
          return {
            doc,
            metadata,
            distance: Math.max(0, score),
            keywordMatches,
            keyTermMatches,
            contentTypeBoost,
            structureBoost,
            lengthBoost,
            originalDistance: allDistances[i] || 1.0
          };
        });
        
        console.log(`chromaTool: Enhanced hybrid search results:`, JSON.stringify({
          docsCount: hybridResults.length,
          avgDistance: (hybridResults.reduce((sum, r) => sum + r.distance, 0) / hybridResults.length).toFixed(3),
          avgOriginalDistance: (hybridResults.reduce((sum, r) => sum + r.originalDistance, 0) / hybridResults.length).toFixed(3),
          keywordBoosts: hybridResults.filter(r => r.keywordMatches > 0).length,
          keyTermBoosts: hybridResults.filter(r => r.keyTermMatches > 0).length
        }, null, 2));
        
        if (!hybridResults.length) return "No relevant information found in your uploaded document.";
        
        // Sort by enhanced distance score and take top results
        hybridResults.sort((a, b) => a.distance - b.distance);
        const topResults = hybridResults.slice(0, 10); // Increased to 10 best results
        
        console.log(`chromaTool: Top results with enhanced scoring:`, topResults.map(r => ({
          distance: r.distance.toFixed(3),
          original: r.originalDistance.toFixed(3),
          keywords: r.keywordMatches,
          keyTerms: r.keyTermMatches,
          contentType: r.metadata.contentType
        })));
        
        // Build a clean, user-friendly context without technical metadata
        let context = topResults.map((result, i) => {
          const { doc } = result;
          const safeDoc = doc ?? '';
          
          // Return only the clean document content without any technical information
          return safeDoc.trim();
        }).join("\n\n");
        
        // If we have results, just return the clean content
        if (context.trim()) {
          console.log(`chromaTool: Returning clean context with ${topResults.length} chunks`);
          return context;
        } else {
          return "No relevant information found in your uploaded document.";
        }      },
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
        // Validate and enhance the location query
        if (!location || location.trim().length === 0) {
          return "Please provide a valid location to check the weather.";
        }
        
        // Clean up the location string
        const cleanLocation = location.trim().replace(/^(in|en|at|for|para)\s+/i, '');
        
        // Get API key from config
        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        if (!apiKey) {
          console.error("OpenWeatherMap API key is missing from configuration");
          return "OpenWeatherMap API key is missing.";
        }
        
        console.log(`OpenWeatherMapTool: Fetching weather for "${cleanLocation}"`);
        
        try {
          // First get geocoding data to convert location to coordinates
          // Make sure we're using https, not http (might be blocked by browser security)
          const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanLocation)}&limit=1&appid=${apiKey}`;
          console.log(`Calling geocoding API for: ${cleanLocation}`);
          
          // Fetch geocoding data
          const geoRes = await fetch(geoUrl);
          
          // Check for HTTP errors first
          if (!geoRes.ok) {
            console.error(`Geocoding API error: HTTP ${geoRes.status} - ${geoRes.statusText}`);
            const errorText = await geoRes.text();
            console.error(`Response body: ${errorText}`);
            return `Could not find location data for ${cleanLocation}. API returned error ${geoRes.status}.`;
          }
          
          // Parse the response
          const geoData = await geoRes.json();
          console.log(`Geocoding response for "${cleanLocation}": ${JSON.stringify(geoData)}`);
          
          if (!geoData || geoData.length === 0) {
            console.error(`Could not find location data for ${cleanLocation}`);
            return `Could not find location data for ${cleanLocation}. Please try with a more specific location.`;
          }
          
          // Extract location info from geocoding response
          const { lat, lon, name, country } = geoData[0];
          console.log(`Found location: ${name}, ${country} at coordinates: ${lat}, ${lon}`);
          
          // Then get the actual weather data using coordinates
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
          console.log(`Calling weather API for: ${name}, ${country}`);
          
          // Fetch weather data
          const weatherRes = await fetch(weatherUrl);
          
          // Check for HTTP errors
          if (!weatherRes.ok) {
            console.error(`Weather API error: HTTP ${weatherRes.status} - ${weatherRes.statusText}`);
            const errorText = await weatherRes.text();
            console.error(`Response body: ${errorText}`);
            return `Failed to fetch weather. API returned error ${weatherRes.status}.`;
          }
          
          // Parse the response
          const weatherData = await weatherRes.json();
          console.log(`Weather API response status: ${weatherRes.status}, data:`, weatherData);
          
          // Extract weather data
          const { temp, feels_like, humidity } = weatherData.main;
          const description = weatherData.weather[0].description;
          const windSpeed = weatherData.wind?.speed || 'N/A';
          
          console.log(`Successfully retrieved weather for ${name}, ${country}`);
          
          // Return formatted weather information
          return `Current weather in ${name}, ${country}: ${description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%. Wind speed: ${windSpeed} m/s.`;
        } catch (error) { 
          console.error(`Error in openWeatherMapTool: ${error.message}`, error);
          return `An error occurred while fetching weather for ${cleanLocation}. Please try again with a more specific location.`; 
        }
      },
    });

    // --- AGENT REGISTRY PLUGIN PATTERN ---
    // Register built-in agents/tools if not already registered
    if (!AgentRegistry.getAgent('web_search')) {
      AgentRegistry.register({
        name: 'web_search',
        description: searchTool.description,
        handle: async (input, context, callAgent) => {
          const result = await searchTool.func({ query: input }, context);
          return { output: result, confidence: 0.8 };
        }
      });
    }
    if (!AgentRegistry.getAgent('document_search')) {
      AgentRegistry.register({
        name: 'document_search',
        description: chromaTool.description,
        handle: async (input, context, callAgent) => {
          const result = await chromaTool.func({ question: input }, context);
          return { output: result, confidence: 0.8 };
        }
      });
    }
    if (!AgentRegistry.getAgent('current_time')) {
      AgentRegistry.register({
        name: 'current_time',
        description: currentTimeTool.description,
        handle: async (input, context, callAgent) => {
          const result = await currentTimeTool.func({ timezone: input }, context);
          return { output: result, confidence: 0.9 };
        }
      });
    }
    if (!AgentRegistry.getAgent('open_weather_map')) {
      AgentRegistry.register({
        name: 'open_weather_map',
        description: openWeatherMapTool.description,
        handle: async (input, context, callAgent) => {
          console.log(`open_weather_map agent handling: "${input}" with context:`, context);
          try {
            // Make sure we're getting the location correctly
            if (!input || input.trim().length === 0) {
              return { 
                output: "I need a specific location to check the weather. For example, try 'What's the weather in New York?' or 'Weather in Tokyo'.",
                confidence: 0.5
              };
            }
            
            // Make sure context has sessionId
            const sessionId = context?.userId || context?.configurable?.sessionId || context?.metadata?.sessionId;
            console.log(`Using sessionId for weather: ${sessionId}`);
            
            // Debug API key presence
            const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
            if (!apiKey) {
              console.error("OpenWeatherMap API key is missing from configuration");
            } else {
              console.log(`OpenWeatherMap API key is present: ${apiKey.substring(0, 4)}...`);
            }
            
            // Add additional debugging for the location
            console.log(`Calling OpenWeatherMap API with location: "${input}"`);
            
            const result = await openWeatherMapTool.func({ location: input }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            console.log(`Weather result for ${input}: ${result.substring(0, 100)}...`);
            
            // Check if result indicates an error
            if (result.includes("Could not find location data") ||
                result.includes("API key is missing") || 
                result.includes("Failed to fetch weather") ||
                result.includes("An error occurred")) {
              console.warn(`OpenWeatherMap returned error: ${result}`);
              return { output: result, confidence: 0.5 };
            }
            
            return { output: result, confidence: 0.95 };
          } catch (error) {
            console.error(`Error in open_weather_map agent: ${error.message}`);
            return { 
              output: `Failed to get weather information for "${input}". Please try again with a specific city name.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Register the research agent if it doesn't exist
    if (!AgentRegistry.getAgent('research')) {
      AgentRegistry.register({
        name: 'research',
        description: 'An agent specialized in web research and information retrieval',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`research agent handling: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the research agent executor
            const result = await researchAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            return { 
              output: typeof result === 'string' ? result : result.output, 
              confidence: 0.75
            };
          } catch (error) {
            console.error(`Error in research agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while researching your request.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Register the document_search agent if it doesn't exist
    if (!AgentRegistry.getAgent('document_search')) {
      AgentRegistry.register({
        name: 'document_search',
        description: 'An agent specialized in searching and retrieving information from uploaded documents',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`document_search agent handling: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the document agent executor
            const result = await documentAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            // Format the output and fix URLs with spaces
            let output = typeof result === 'string' ? result : result.output;
            
            // Fix URLs with spaces by detecting URL patterns and encoding them properly
            if (output && typeof output === 'string') {
              output = output.replace(/(https?:\/\/[^\s"]+)\s+/g, (match, url) => {
                // If the URL has spaces or unencoded characters, fix it
                if (url.includes(' ') || /[^\w\-\.~:\/\?#\[\]@!\$&'\(\)\*\+,;=]/.test(url)) {
                  try {
                    // Try to properly encode the URL while preserving the URL structure
                    const fixedUrl = url.replace(/\s+/g, '%20');
                    return fixedUrl + ' ';
                  } catch (e) {
                    console.error('Error fixing URL:', e);
                    return match; // Return original if encoding fails
                  }
                }
                return match;
              });
            }
            
            return { 
              output: output, 
              confidence: 0.8
            };
          } catch (error) {
            console.error(`Error in document_search agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while searching your documents.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Register the time agent if it doesn't exist
    if (!AgentRegistry.getAgent('time')) {
      AgentRegistry.register({
        name: 'time',
        description: 'An agent specialized in providing current time and date information',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`time agent handling: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the time agent executor
            const result = await timeAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            return { 
              output: typeof result === 'string' ? result : result.output, 
              confidence: 0.9
            };
          } catch (error) {
            console.error(`Error in time agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while processing your time request.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Register the weather agent if it doesn't exist
    if (!AgentRegistry.getAgent('weather')) {
      AgentRegistry.register({
        name: 'weather',
        description: 'An agent specialized in providing weather information',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`weather agent handling: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the weather agent executor
            const result = await weatherAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            return { 
              output: typeof result === 'string' ? result : result.output, 
              confidence: 0.85
            };
          } catch (error) {
            console.error(`Error in weather agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while processing your weather request.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Register the general agent if it doesn't exist
    if (!AgentRegistry.getAgent('general')) {
      AgentRegistry.register({
        name: 'general',
        description: 'A general-purpose agent that can handle a wide variety of tasks',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`general agent handling: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the general agent executor
            const result = await generalAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            return { 
              output: typeof result === 'string' ? result : result.output, 
              confidence: 0.7 
            };
          } catch (error) {
            console.error(`Error in general agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while processing your request.`,
              confidence: 0.5
            };
          }
        }
      });
    }

    // Allow dynamic agent/skill registration via AgentRegistry
    const allDynamicTools = AgentRegistry.getAllAgents().map(agent =>
      new DynamicStructuredTool({
        name: agent.name,
        description: agent.description,
        schema: z.object({ input: z.string().describe("Input for the agent/skill/tool.") }),
        func: async ({ input }, context) => {
          try {
            // Create a properly bound version of callAgent
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            const result = await agent.handle(input, context, boundCallAgent);
            return result.output;
          } catch (error) {
            console.error(`Error in dynamic tool ${agent.name}:`, error);
            return `Error executing ${agent.name}: ${error.message}`;
          }
        }
      })
    );

    // Create specialized tool sets for different agent types
    // Use the original tools directly for specialized agents to avoid schema conflicts
    const timeTools = [currentTimeTool, searchTool];
    const weatherTools = [openWeatherMapTool, searchTool];
    const researchTools = [searchTool];
    const documentTools = [chromaTool, searchTool];
    const generalTools = allDynamicTools; // General agent gets all tools

    const createAgentExecutor = (systemMessage: string, agentType: 'general' | 'specialized' = 'specialized', tools?: any[]): AgentExecutor => {
      let finalSystemMessage = systemMessage;
      if (topic) {
        finalSystemMessage = `Your most important rule is that you are an assistant dedicated ONLY to the topic of "${topic}". You must politely refuse any request that is not directly related to this topic.\n\n` + systemMessage;
      }
      
      const agentTools = tools || generalTools;
      console.log(`createAgentExecutor: Creating agent with ${agentTools.length} tools: ${agentTools.map(t => t.name).join(', ')}`);
      const llmWithTools = llm.bindTools ? llm.bindTools(agentTools) : llm;
      
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", finalSystemMessage],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
      ]);
      const agent = createToolCallingAgent({ llm: llmWithTools, tools: agentTools, prompt });
      return new AgentExecutor({ agent, tools: agentTools, verbose: true });
    };

    // Make sure it processes and outputs in the same language as the query
    const createDocumentAgent = (systemMessage: string): AgentExecutor => {
      let finalSystemMessage = systemMessage;
      if (topic) {
        finalSystemMessage = `Your most important rule is that you are an assistant dedicated ONLY to the topic of "${topic}". You must politely refuse any request that is not directly related to this topic.\n\n` + systemMessage;
      }
      
      // Add extra language enforcement to the system message
      finalSystemMessage = `${finalSystemMessage}\n\nCRITICAL LANGUAGE INSTRUCTION: ALWAYS respond in the EXACT SAME language as the user's query. If the user asks in Spanish, you MUST respond in Spanish. If the user asks in English, respond in English. Automatically adapt to match the language of each query.`;
      
      const agentTools = documentTools;
      console.log(`createDocumentAgent: Creating agent with ${agentTools.length} tools: ${agentTools.map(t => t.name).join(', ')}`);
      const llmWithTools = llm.bindTools ? llm.bindTools(agentTools) : llm;
      
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", finalSystemMessage],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
      ]);
      const agent = createToolCallingAgent({ llm: llmWithTools, tools: agentTools, prompt });
      return new AgentExecutor({ agent, tools: agentTools, verbose: true });
    };

    const timeAgent = createAgentExecutor(TIME_AGENT_PROMPT, 'specialized', timeTools);
    const weatherAgent = createAgentExecutor(WEATHER_AGENT_PROMPT, 'specialized', weatherTools);
    // Always use the detailed RESEARCH_AGENT_PROMPT for the research agent, even with chat history
    const researchAgent = createAgentExecutor(RESEARCH_AGENT_PROMPT, 'specialized', researchTools);
    const generalAgent = createAgentExecutor(GENERAL_AGENT_PROMPT, 'general', generalTools);
    // Use our enhanced document agent creator for better language handling
    const documentAgent = createDocumentAgent(DOCUMENT_AGENT_PROMPT);      // This is our main runnable. It's a single Lambda that contains all the logic.
    const finalRunnable = new RunnableLambda({
      func: async (input: { input: string; chat_history: BaseMessage[] }, config?: any) => {
        const lowerCaseInput = input.input.toLowerCase();
        const lastAIMessage = input.chat_history.filter(m => m._getType() === 'ai').slice(-1)[0]?.content.toString().toLowerCase() ?? "";

        // Extract session ID from config for consistent tracking
        const sessionId = (config as any)?.configurable?.sessionId || 
                        (config as any)?.metadata?.sessionId || 
                        (config as any)?.userId;
        
        if (sessionId) {
          console.log(`Processing message for session ${sessionId} with ${input.chat_history.length} history messages`);
        } else {
          console.warn('No session ID found in context, message history may not work properly');
        }

        const timeKeywords = [
          'hora', 'time', 'fecha', 'date', 'día', 'dia',
          'what time', 'current time', 'time in', 'time is',
          'timezone', 'clock', 'now in', 'hora en',
          'qué hora', 'que hora', 'what\'s the time',
          'tell me the time', 'current local time', 'local time'
        ];
        const weatherKeywords = ['clima', 'temperatura', 'weather', 'pronóstico', 'forecast', 'llover', 'lluvia', 'rain', 'snow', 'nieve', 'cloudy', 'nublado', 'sunny', 'soleado', 'cold', 'frío', 'hot', 'calor', 'wind', 'viento'];
        const documentKeywords = [
          'documento', 'pdf', 'file', 'archivo', 'subido', 'upload', 'uploaded',
          'constitución', 'constitution', 'artículo', 'article', 
          'mi documento', 'my document', 'el documento', 'the document',
          'documento que subí', 'document I uploaded', 'archivo que subí',
          'texto subido', 'uploaded text', 'contenido subido',
          // Additional Spanish document references
          'según el documento', 'segun el documento', 'según el archivo', 'segun el archivo',
          'en el documento', 'en el archivo', 'en el pdf', 'en el texto',
          'el documento dice', 'el archivo dice', 'el texto dice',
          'menciona el documento', 'dice el documento', 'indica el documento',
          'según lo que dice', 'segun lo que dice', 'de acuerdo al documento',
          'conforme al documento', 'basado en el documento', 'en base al documento'
        ];
        const codeKeywords = ['code', 'código', 'programming', 'programación', 'function', 'función', 'script', 'debug', 'error', 'optimize', 'optimizar', 'refactor', 'syntax', 'algorithm', 'algoritmo', 'class', 'method', 'variable', 'loop', 'if', 'else', 'import', 'export', 'const', 'let', 'var', 'async', 'await'];
        const optimizationKeywords = ['optimize', 'optimizar', 'performance', 'rendimiento', 'faster', 'más rápido', 'improve', 'mejorar', 'efficient', 'eficiente', 'slow', 'lento', 'speed up', 'acelerar'];
        const researchKeywords = [
          "investiga", "busca en internet", "investigación", "research", "web_search", "buscar información", "averigua", "encuentra en la web",
          // Company info triggers
          "fundador", "founder", "fundadores", "founders", "año de fundación", "año fundación", "año de creacion", "año de creación", "año de inicio",
          "fecha de fundación", "fecha de creacion", "fecha de creación", "industry", "ramo", "sector", "actividad principal", "empresa", "compañía", "company",
          // Location/places/travel/tourism/experience triggers
          "donde", "lugares", "sitios", "qué hacer en", "que hacer en", "places to visit", "things to do", "where can i", "what to do", "recommend", "recomienda", "atracciones", "turismo", "viajar", "visitar", "restaurantes", "bares", "vida nocturna",
          // Expanded tourism/outing/romantic/fun triggers
          "cerca de", "alrededor de", "en las proximidades de", "en las cercanías de",
          "para divertirme", "para divertirse", "para pasarla bien", "para pasar bien", "pasar bien", "divertirme", "divertirse", "disfrutar", "entretenerme", "entretenerse", "salir",
          "romántico", "romántica", "románticos", "románticas", "cita", "citas", "pareja", "parejas",
          "hotel", "hoteles", "restaurante", "restaurantes", "comida", "comidas", "evento", "eventos",
          "playa", "playas", "montaña", "montañas", "parque", "parques", "museo", "museos", "monumento", "monumentos",
          "tour", "tours", "guía", "guías", "excursión", "excursiones", "actividad", "actividades",
          // English
          "near", "nearby", "around", "in the vicinity of", "close to",
          "for fun", "to have fun", "to enjoy", "to go out", "nightlife",
          "romantic", "romantics", "date", "dates", "couple", "couples",
          "where can i have fun", "donde lo puedo pasar bien", "donde puedo divertirme", "donde puedo pasarla bien", "donde puedo disfrujar", "donde puedo salir", "donde puedo entretenerme", "donde puedo encontrar"
        ];

        // Check for code blocks (```code```) - if found, use code interpreter through agent registry
        const hasCodeBlocks = /```[\s\S]*?```/.test(input.input);
        
        // Set up consistent context with session ID for agent registry calls
        // Ensure we're passing the sessionId consistently in all places
        const agentContext = {
          userId: sessionId,
          sessionId: sessionId,
          chatHistory: input.chat_history,
          configurable: {
            ...(config?.configurable || {}),
            sessionId: sessionId
          },
          metadata: {
            ...(config?.metadata || {}),
            sessionId: sessionId
          },
          ...config
        };
        
        // Log the context we're using for debugging
        console.log(`Agent context keys: ${Object.keys(agentContext).join(', ')}`);
        console.log(`Using session ID: ${sessionId}`);
        
        // Use a fully language-agnostic approach by considering all available agents
        // Let the LLM and confidence scores determine the best agent for the task
        
        // Get all registered agents from AgentRegistry
        const allRegisteredAgents = AgentRegistry.getAllAgents().map(agent => agent.name);
        console.log(`Found ${allRegisteredAgents.length} registered agents: ${allRegisteredAgents.join(', ')}`);
        
        // Start with a comprehensive set of agents to consider
        let agentsToConsider: string[] = [
          'general', // Always include general as a baseline
          ...allRegisteredAgents.filter(name => name !== 'general') // Add all other registered agents
        ];
        
        // Remove duplicate entries if any exist
        agentsToConsider = [...new Set(agentsToConsider)];
        
        // Check only for code blocks as this is a technical characteristic, not linguistic
        if (hasCodeBlocks && !agentsToConsider.includes('code_interpreter')) {
          console.log('Code blocks detected in input');
          if (agentsToConsider.indexOf('general') > 0) {
            // Move general agent after code-related agents for code blocks
            agentsToConsider = agentsToConsider.filter(name => name !== 'general');
            agentsToConsider.push('general');
          }
        }
        
        console.log(`Language-agnostic approach: considering all agents with confidence-based routing`);
        console.log(`Agents to consider: ${agentsToConsider.join(', ')}`);
        
        // For very short inputs (less than 10 characters), consider a smaller set of agents
        // This is a performance optimization, not a linguistic assumption
        if (input.input.trim().length < 10) {
          console.log('Very short input detected, using a focused set of agents');
          // For very short inputs, prioritize general conversation but let other agents have a chance too
          const focusedAgents = ['general'];
          
          // Add a few key agents for short inputs but keep the list small
          if (allRegisteredAgents.includes('weather')) focusedAgents.push('weather');
          if (allRegisteredAgents.includes('time')) focusedAgents.push('time');
          
          agentsToConsider = focusedAgents;
        }
        
        console.log(`Agents to consider: ${agentsToConsider.join(', ')}`);
        
        // We'll let the LLM models handle language detection and processing
        // Just pass the original input without any language-specific processing
        // This makes our system truly language-agnostic
        
        // We'll only enhance the context with session tracking information
        const enhancedAgentContext = {
          ...agentContext,
          // Include the raw input text for the LLM to determine language
          rawInput: input.input,
          // Include message length as a non-linguistic feature
          inputLength: input.input.length,
          // Include metadata about message history
          historyLength: input.chat_history.length
        };
        
        // Capture name declarations in a language-agnostic way
        // We'll let the LLM handle remembering names through chat history
        // rather than trying to extract it with regex patterns
        
        // Always try to use the AgentOrchestrator for consistent history handling
        try {
          // Use AgentOrchestrator for ALL routing to ensure consistent context handling
          console.log(`Using AgentOrchestrator to route among: ${agentsToConsider.join(', ')}`);
          
          const routingResult = await AgentOrchestrator.routeByConfidence(
            agentsToConsider, 
            input.input, 
            enhancedAgentContext // Use the enhanced context with language info
          );
          
          console.log(`AgentOrchestrator selected: ${routingResult.agent} with confidence ${routingResult.result.confidence}`);
          
          // If the result is from a registered agent, return it directly
          if (routingResult && routingResult.result) {
            return { output: routingResult.result.output };
          }
          
        } catch (error) {
          console.error(`Error with AgentOrchestrator: ${error.message}`);
          // Continue to fallback path
        }
        
        // If the orchestrator failed, fall back to direct executor usage
        // but ensure we're still passing the consistent context
        let selectedAgent = generalAgent; // Default
        
        // Find the appropriate executor based on the first agent in the list
        if (agentsToConsider.length > 0) {
          const agentName = agentsToConsider[0];
          if (agentName === 'time') {
            selectedAgent = timeAgent;
          } else if (agentName === 'weather') {
            selectedAgent = weatherAgent;
          } else if (agentName === 'document_search') {
            selectedAgent = documentAgent;
          } else if (agentName === 'research') {
            selectedAgent = researchAgent;
          }
        }

        // Try the selected agent - ensure we pass both history and context correctly
        console.log(`Falling back to direct executor: ${selectedAgent.constructor.name}`);
        let result = await selectedAgent.invoke({
          input: input.input,
          chat_history: input.chat_history
        }, enhancedAgentContext); // Pass the enhanced context with language information

        // If the general agent was used, check for refusal patterns and try research agent as fallback
        if (selectedAgent === generalAgent) {
          const output = typeof result === 'string' ? result : (result && typeof result.output === 'string' ? result.output : '');
          
          // Language-agnostic refusal detection by checking for common refusal patterns
          const fallbackRegex = new RegExp(
            [
              // Spanish refusals
              'no puedo acceder a información en tiempo real',
              'no puedo acceder a internet',
              'no tengo acceso a internet',
              'no puedo buscar',
              'no puedo acceder a información actualizada',
              'no puedo acceder a información actual',
              'no puedo acceder a información externa',
              'no puedo buscar en internet',
              'no puedo acceder a información en la web',
              'como modelo de lenguaje',
              'no tengo acceso a información en tiempo real',
              'no puedo navegar por internet',
              'no tengo capacidad de buscar en internet',
              'no tengo acceso a información externa',
              // English refusals
              'as a language model',
              'i do not have access to real-time information',
              'i do not have access to the internet',
              'i cannot browse the internet',
              'i am unable to browse the internet',
              'i do not have access to current information',
              'i cannot access external information',
              'i cannot search the internet',
              'i do not have access to up-to-date information',
              'i do not have browsing capabilities',
              'i am unable to access real-time information',
              'i am unable to access the internet',
              'i am unable to access current information',
              'i am unable to access external information',
              'i am unable to search the internet',
              'i am unable to access up-to-date information',
              'i am unable to access browsing capabilities',
              'i recommend using an online search engine',
              'please use an online search engine',
              'i suggest using an online search engine',
              'i suggest searching online',
              'i recommend searching online',
              'i recommend checking online',
              'i recommend looking online',
              'i recommend using google',
              'i recommend using bing',
              'i recommend using duckduckgo',
              'i recommend using a search engine',
              'i recommend you search online',
              'i recommend you check online',
              'i recommend you look online',
              'i recommend you use google',
              'i recommend you use bing',
              'i recommend you use duckduckgo',
              'i recommend you use a search engine',
            ].join('|'),
            'i'
          );
          
          if (output && fallbackRegex.test(output) && AgentRegistry.getAgent('research')) {
            console.log('General agent returned refusal, trying research agent as fallback');
            result = await researchAgent.invoke({
              input: input.input,
              chat_history: input.chat_history
            }, enhancedAgentContext); // Pass the enhanced context with language information
          }
        }
        
        return result;
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
        
        // Ensure we're creating a new instance of MongoDBChatMessageHistory for each call
        // This is critical to avoid message history issues
        const messageHistory = new MongoDBChatMessageHistory(this.chatSessionModel, sessionId);
        
        // Debug log the current message count to help identify issues
        messageHistory.debugMessageCount().catch(err => {
          this.logger.error(`Failed to debug message count: ${err.message}`);
        });
        
        // Also debug the recent message content
        messageHistory.debugRecentMessages(2).catch(err => {
          this.logger.error(`Failed to debug recent messages: ${err.message}`);
        });
        
        return messageHistory;
      },
      // These keys MUST match the structure expected by LangChain RunnableWithMessageHistory
      // Make sure they match the structure used in finalRunnable.func
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "output"
    });

    // Register the summarizer agent
    if (!AgentRegistry.getAgent('summarizer')) {
      this.logger.log('Registering summarizer agent');
      AgentRegistry.register({
        name: 'summarizer',
        description: 'An agent specialized in summarizing content from various sources',
        handle: async (input, context, callAgent) => {
          try {
            console.log(`summarizer agent handling input: "${input.substring(0, 50)}..."`);
            
            // Create a properly bound version of callAgent for any chained calls
            const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
            
            // Use the general agent to process the summarization request
            // This is because summarization is a general capability
            const result = await generalAgent.invoke({
              input: input,
              chat_history: context.chatHistory || []
            }, {
              ...context,
              configurable: {
                ...(context?.configurable || {}),
                sessionId: context.sessionId || context.userId
              },
              metadata: {
                ...(context?.metadata || {}),
                sessionId: context.sessionId || context.userId
              }
            });
            
            return { 
              output: typeof result === 'string' ? result : result.output, 
              confidence: 0.8
            };
          } catch (error) {
            console.error(`Error in summarizer agent: ${error.message}`, error.stack);
            return { 
              output: `I'm sorry, I encountered an error while summarizing the content.`,
              confidence: 0.5
            };
          }
        }
      });
    }
    
    // Verify all required agents are properly registered before returning
    this.verifyAgentRegistrations();
    
    // Add a final log to confirm that we're correctly using AgentOrchestrator
    this.logger.log(`Langchain app created with AgentOrchestrator integration for confident-based agent routing`);
    this.logger.log(`Message history is using MongoDBChatMessageHistory for persistence`);
    
    return agentWithHistory;
  }

  /**
   * Register built-in agents in the AgentRegistry
   * This ensures they are available when pluggable agents need to call them
   */

  /**
   * Extracts keywords from the user's question for better matching
   */
  private extractQuestionKeywords(question: string): string[] {
    const questionLower = question.toLowerCase();
    const keywords: string[] = [];
    
    // Extract article/section references
    const articleRefs = questionLower.match(/artículo\s+\d+|article\s+\d+/g);
    if (articleRefs) {
      keywords.push(...articleRefs);
    }
    
    // Extract important question words
    const importantWords = questionLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['what', 'como', 'donde', 'cuando', 'porque', 'cual', 'quien', 'dice', 'trata', 'contiene', 'sobre', 'acerca'].includes(word)
      );
    
    keywords.push(...importantWords);
    
    // Add question-specific terms
    if (questionLower.includes('constitución') || questionLower.includes('constitution')) {
      keywords.push('constitución', 'constitution');
    }
    
    return [...new Set(keywords)];
  }

  /**
   * Gets content type boost based on question intent
   */
  private getContentTypeBoost(contentType: string, question: string): number {
    const questionLower = question.toLowerCase();
    
    // If asking about specific articles, boost article content
    if ((questionLower.includes('artículo') || questionLower.includes('article')) && contentType === 'article') {
      return 0.2; // 20% boost
    }
    
    // If asking about definitions, boost definition content
    if ((questionLower.includes('definición') || questionLower.includes('definition') || questionLower.includes('qué es')) && contentType === 'definition') {
      return 0.15;
    }
    
    // If asking about procedures, boost procedure content
    if ((questionLower.includes('procedimiento') || questionLower.includes('cómo') || questionLower.includes('proceso')) && contentType === 'procedure') {
      return 0.15;
    }
    
    // Headers are generally important for overview questions
    if ((questionLower.includes('trata') || questionLower.includes('sobre') || questionLower.includes('resumen')) && contentType === 'header') {
      return 0.1;
    }
    
    return 0;
  }

  /**
   * Gets structure boost based on document metadata
   */
  private getStructureBoost(metadata: any, docLower: string): number {
    let boost = 0;
    
    // Prefer chunks that start with headers (complete sections)
    if (metadata.startsWithHeader) {
      boost += 0.1;
    }
    
    // Prefer chunks with article references
    if (metadata.hasArticleReference) {
      boost += 0.1;
    }
    
    // Prefer chunks with numbers (often contain specific information)
    if (metadata.hasNumbers) {
      boost += 0.05;
    }
    
    return boost;
  }

  /**
   * Gets length boost based on chunk size (prefer medium-sized chunks)
   */
  private getLengthBoost(length: number): number {
    // Prefer chunks between 800-2000 characters (complete thoughts but not too long)
    if (length >= 800 && length <= 2000) {
      return 0.1;
    }
    
    // Slight preference for longer chunks over very short ones
    if (length >= 500 && length < 800) {
      return 0.05;
    }
    
    // Penalize very short chunks (likely incomplete)
    if (length < 200) {
      return -0.1; // Actually increase distance (worse score)
    }
    
    return 0;
  }

  /**
   * Verifies that all required agents are properly registered
   * This is called before returning the agent with history to ensure all agents are available
   */
  private verifyAgentRegistrations(): void {
    // List of required agents that must be registered
    const requiredAgents = ['general', 'research', 'web_search', 'weather', 'time', 'document_search', 'open_weather_map', 'summarizer'];
    
    // Check each required agent
    const missingAgents = requiredAgents.filter(name => !AgentRegistry.getAgent(name));
    
    if (missingAgents.length > 0) {
      this.logger.warn(`Missing required agents: ${missingAgents.join(', ')}`);
      
      // Register any missing agents as fallbacks that will show a nice error message
      for (const missingAgent of missingAgents) {
        this.logger.warn(`Registering fallback handler for missing agent: ${missingAgent}`);
        
        // Register a fallback agent that will show an appropriate error
        AgentRegistry.register({
          name: missingAgent,
          description: `Fallback for ${missingAgent} agent`,
          handle: async (input, context, callAgent) => {
            this.logger.error(`Fallback handler called for missing agent: ${missingAgent}`);
            return {
              output: `I'm sorry, the ${missingAgent} feature is currently unavailable. Please try again later or try a different query.`,
              confidence: 0.5
            };
          }
        });
      }
    } else {
      this.logger.log('All required agents are properly registered');
    }
    
    // Log the final state of agent registry
    const registeredAgents = AgentRegistry.getAllAgents().map(a => a.name);
    this.logger.log(`Final agent registry state: ${registeredAgents.join(', ')}`);
  }
}