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
      name: "web_search",
      description: "Searches the web for up-to-date information. Research info about companies. Resarch info.",
      schema: z.object({ query: z.string().describe("A keyword-based search query.") }),
      func: async ({ query }) => { try { return await new TavilySearch().invoke({ query }); } catch (e) { this.logger.error(`Tavily search failed for query: ${query}`, e.stack); return "Search failed."; } },
    });

    // ChromaDB document retrieval tool
    const chromaTool = new DynamicStructuredTool({
      name: "document_search",
      description: "Use this tool for ANY question about the user's uploaded PDF, document, or file, including questions like: 'What is the main topic of the PDF I uploaded?', 'Summarize my document', 'What does my file say about X?', 'What is the summary of the uploaded file?', 'What are the key points in my document?', 'What is the uploaded PDF about?', 'What topics are covered in my file?', etc. Use this tool whenever the user refers to 'the PDF I uploaded', 'my document', 'uploaded file', 'the file', or similar phrases, even if the question is not directly about the file name.",
      schema: z.object({ question: z.string().describe("A question about the user's uploaded document, PDF, or file.") }),
      func: async ({ question }, config) => {
        // Extract sessionId from config.configurable.sessionId (as used by /chat service)
        let sessionId = (config as any)?.metadata?.sessionId || (config as any)?.configurable?.sessionId;
        console.log(`configurable: ${JSON.stringify((config as any))}`);
        console.log(`chromaTool: Processing document search for session ID: ${sessionId}`);
        if (!sessionId) return "No session ID provided.";
        // Embed the question
        const embedder = new (require('@langchain/google-genai').GoogleGenerativeAIEmbeddings)({ apiKey: process.env.GEMINI_API_KEY });
        const [queryEmbedding] = await embedder.embedDocuments([question]);
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
        // Use similarity search: only return the most similar chunks (not all parts)
        const nResults = 5;
        const results = await collection.query({ queryEmbeddings: [queryEmbedding], nResults, include: ["metadatas", "documents", "distances"] });
        const docs = results.documents?.[0] || [];
        const metadatas = results.metadatas?.[0] || [];
        const distances = results.distances?.[0] || [];
        if (!docs.length) return "No relevant information found in your uploaded document.";
        // Build a detailed context with metadata for only the most similar chunks
        let context = docs.map((doc, i) => {
          const meta = metadatas[i] || {};
          const dist = distances[i];
          const safeDoc = doc ?? '';
          // Return a string that includes all relevant info for the agent to process
          return `--- Chunk Source: ${meta.source ?? 'N/A'}, Chunk Number: ${meta.chunk ?? i}, Distance: ${dist?.toFixed(3) ?? 'N/A'} ---\\n${safeDoc}`;        }).join("\\n\\n");
        // Return ONLY the context. The agent will formulate the answer.
        return context;      },
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
          const result = await openWeatherMapTool.func({ location: input }, context);
          return { output: result, confidence: 0.9 };
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
          const result = await agent.handle(input, context, AgentRegistry.callAgent);
          return result.output;
        }
      })
    );

    // Create specialized tool sets for different agent types
    const timeTools = allDynamicTools.filter(tool => tool.name === 'current_time' || tool.name === 'web_search');
    const weatherTools = allDynamicTools.filter(tool => tool.name === 'open_weather_map' || tool.name === 'web_search');
    const researchTools = allDynamicTools.filter(tool => tool.name === 'web_search' || tool.name === 'calculator');
    const documentTools = allDynamicTools.filter(tool => tool.name === 'pdf_retrieval' || tool.name === 'web_search');
    const generalTools = allDynamicTools; // General agent gets all tools

    const createAgentExecutor = (systemMessage: string, agentType: 'general' | 'specialized' = 'specialized', tools?: any[]): AgentExecutor => {
      let finalSystemMessage = systemMessage;
      if (topic) {
        finalSystemMessage = `Your most important rule is that you are an assistant dedicated ONLY to the topic of "${topic}". You must politely refuse any request that is not directly related to this topic.\n\n` + systemMessage;
      }
      
      const agentTools = tools || generalTools;
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
    const documentAgent = createAgentExecutor(DOCUMENT_AGENT_PROMPT, 'specialized', documentTools);

    // This is our main runnable. It's a single Lambda that contains all the logic.
    const finalRunnable = new RunnableLambda({
      func: async (input: { input: string; chat_history: BaseMessage[] }, config?: any) => {
        const lowerCaseInput = input.input.toLowerCase();
        const lastAIMessage = input.chat_history.filter(m => m._getType() === 'ai').slice(-1)[0]?.content.toString().toLowerCase() ?? "";

        const timeKeywords = [
          'hora', 'time', 'fecha', 'date', 'día', 'dia',
          'what time', 'current time', 'time in', 'time is',
          'timezone', 'clock', 'now in', 'hora en',
          'qué hora', 'que hora', 'tiempo en', 'what\'s the time',
          'tell me the time', 'current local time', 'local time'
        ];
        const weatherKeywords = ['clima', 'temperatura', 'weather', 'pronóstico', 'forecast', 'llover', 'lluvia', 'rain', 'snow', 'nieve', 'cloudy', 'nublado', 'sunny', 'soleado', 'cold', 'frío', 'hot', 'calor', 'wind', 'viento'];
        const documentKeywords = ['documento', 'pdf', 'file', 'archivo', 'subido', 'upload'];
        const codeKeywords = ['code', 'código', 'programming', 'programación', 'function', 'función', 'script', 'debug', 'error', 'optimize', 'optimizar', 'refactor', 'syntax', 'algorithm', 'algoritmo', 'class', 'method', 'variable', 'loop', 'if', 'else', 'import', 'export', 'const', 'let', 'var', 'async', 'await'];
        const optimizationKeywords = ['optimize', 'optimizar', 'performance', 'rendimiento', 'faster', 'más rápido', 'improve', 'mejorar', 'efficient', 'eficiente', 'slow', 'lento', 'speed up', 'acelerar'];
        const researchKeywords = [
          "investiga", "busca en internet", "investigación", "research", "web_search", "buscar información", "averigua", "encuentra en la web",
          // Company info triggers
          "fundador", "founder", "fundadores", "founders", "año de fundación", "año fundación", "año de creacion", "año de creación", "año de inicio",
          "fecha de fundación", "fecha de creacion", "fecha de creación", "industry", "ramo", "sector", "actividad principal", "empresa", "compañía", "company",
          // Location/places/travel/tourism/experience triggers
          "donde", "lugares", "sitios", "qué hacer", "que hacer", "places to visit", "things to do", "where can i", "what to do", "recommend", "recomienda", "atracciones", "turismo", "viajar", "visitar", "restaurantes", "bares", "vida nocturna",
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

        let selectedAgent: AgentExecutor;

        // Check for code blocks (```code```) - if found, use code interpreter through agent registry
        const hasCodeBlocks = /```[\s\S]*?```/.test(input.input);
        
        // Enhanced routing logic with agent registry integration
        if (hasCodeBlocks) {
          // Code interpretation via agent registry - this will automatically handle contextual search
          try {
            const codeResult = await AgentRegistry.callAgent('code_interpreter', input.input, {
              userId: (config as any)?.configurable?.sessionId,
              ...config
            });
            return { output: codeResult.output };
          } catch (error) {
            // Fallback to research agent if code interpreter fails
            selectedAgent = researchAgent;
          }
        }
        // If the input contains any document/file-related keyword, force document_search
        else if (documentKeywords.some(k => lowerCaseInput.includes(k))) {
          selectedAgent = documentAgent;
        }
        // If the input contains optimization keywords with code, use code-optimization agent
        else if (optimizationKeywords.some(k => lowerCaseInput.includes(k)) && (hasCodeBlocks || codeKeywords.some(k => lowerCaseInput.includes(k)))) {
          try {
            const optimizationResult = await AgentRegistry.callAgent('code-optimization', input.input, {
              userId: (config as any)?.configurable?.sessionId,
              ...config
            });
            return { output: optimizationResult.output };
          } catch (error) {
            // Fallback to code interpreter or research agent
            selectedAgent = codeKeywords.some(k => lowerCaseInput.includes(k)) ? researchAgent : generalAgent;
          }
        }
        // If the input contains code-related keywords (without code blocks), use research with code context
        else if (codeKeywords.some(k => lowerCaseInput.includes(k))) {
          try {
            // Use research agent for code-related questions without code blocks
            const researchResult = await AgentRegistry.callAgent('research', input.input, {
              userId: (config as any)?.configurable?.sessionId,
              codeContext: true,
              ...config
            });
            return { output: researchResult.output };
          } catch (error) {
            selectedAgent = researchAgent;
          }
        }
        // If the input contains any time-related keyword, force time agent
        else if (timeKeywords.some(k => lowerCaseInput.includes(k))) {
          selectedAgent = timeAgent;
        }
        // If the input contains any weather-related keyword, force weather agent
        else if (weatherKeywords.some(k => lowerCaseInput.includes(k))) {
          selectedAgent = weatherAgent;
        }
        // If the input contains any research-related keyword, use research agent via registry
        else if (researchKeywords.some(k => lowerCaseInput.includes(k))) {
          try {
            const researchResult = await AgentRegistry.callAgent('research', input.input, {
              userId: (config as any)?.configurable?.sessionId,
              ...config
            });
            return { output: researchResult.output };
          } catch (error) {
            selectedAgent = researchAgent;
          }
        }
        // If the previous agent was time/weather/document, and the new input matches research keywords, use research agent
        else if ([timeAgent, weatherAgent, documentAgent].includes((input.chat_history.slice(-1)[0] as any)?.agent) && researchKeywords.some(k => lowerCaseInput.includes(k))) {
          selectedAgent = researchAgent;
        }
        else {
          selectedAgent = generalAgent;
        }

        // Try the selected agent
        let result = await selectedAgent.invoke({
          input: input.input,
          chat_history: input.chat_history
        }, config);

        // If the general agent was used and the answer is a refusal or fallback, try the research agent as a fallback
        if (selectedAgent === generalAgent) {
          const output = typeof result === 'string' ? result : (result && typeof result.output === 'string' ? result.output : '');
          // Expanded heuristic: If the general agent says it can't answer, try the research agent
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
          if (output && fallbackRegex.test(output)) {
            result = await researchAgent.invoke({
              input: input.input,
              chat_history: input.chat_history
            }, config);
          }
        }
        return result;
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