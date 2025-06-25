import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableLambda, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { TIME_AGENT_PROMPT, WEATHER_AGENT_PROMPT, GENERAL_AGENT_PROMPT } from "../prompts/agent-prompts";
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
      name: "search",
      description: "Searches the web for up-to-date information.",
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
        logger.debug?.(`CHROMA_URL: ${chromaUrl}`);
        let host = '';
        let port = 8000;
        let ssl = false;
        try {
          const url = new URL(chromaUrl);
          host = url.hostname;
          port = Number(url.port) || 8000;
          ssl = false;
          logger.debug?.(`Parsed Chroma host: ${host}, port: ${port}, ssl: ${ssl}`);
        } catch (err) {
          logger.error?.(`Failed to parse CHROMA_URL: ${chromaUrl}`, err);
        }
        logger.debug?.(`Attempting to connect to ChromaClient with host=${host}, port=${port}, ssl=${ssl}`);
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
          return `---\nChunk #${meta.chunk ?? i} (distance: ${dist?.toFixed(3) ?? 'N/A'})\nLength: ${safeDoc.length} chars\nMessage: ${meta.message ?? ''}\nSource: ${meta.source ?? ''}\nContent:\n${safeDoc}`;
        }).join("\n\n");
        // Return a more helpful answer
        return `Here are the most relevant parts of your uploaded document for your question:\n\n${context}`;
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

    const tools = [searchTool, currentTimeTool, openWeatherMapTool, chromaTool];
    const llmWithTools = llm.bindTools ? llm.bindTools(tools) : llm;

    const createAgentExecutor = (systemMessage: string): AgentExecutor => {
      let finalSystemMessage = systemMessage;
      // Stronger system prompt to force chromatool usage for document questions
      const forceDocToolPrompt = [
        'You are a master research assistant. Your instructions are absolute.',
        '',
        '- **Goal:** Answer the user\'s question in their own language by finding information in their uploaded documents or on the web.',
        '- **Primary Tools:**',
        "    - You MUST use the 'document_search' tool to answer ANY question about the user's uploaded document(s), PDF(s), or file(s). This is MANDATORY for all document/file/PDF-related queries, regardless of wording.",
        "    - You MUST use the 'search' tool to find information on the web for all other questions. This is MANDATORY for all web/general queries.",
        "- Do not apologize or claim you cannot access information. Always use the appropriate tool before answering. Never answer a document-related question without calling the 'document_search' tool first.",
        '',
        '**Examples of questions that MUST use the document_search tool:**',
        "- 'What is the main topic of the PDF I uploaded?'",
        "- 'Summarize my document.'",
        "- 'What does my file say about X?'",
        "- 'What is the summary of the uploaded file?'",
        "- 'What are the key points in my document?'",
        "- 'What is the uploaded PDF about?'",
        "- 'What topics are covered in my file?'",
        "- 'What information is in the document I uploaded?'",
        "- '¿De qué trata el documento que te acabo de subir?'",
        "- 'Resume el PDF que subí.'",
        '',
        '**Rules:**',
        "1. If the user's question is about their uploaded document, PDF, or file (even if not explicit), you MUST call the 'document_search' tool with the user's question. Do NOT answer directly.",
        "2. If the user's question is about something else, you MUST call the 'search' tool with a concise, keyword-based query. Do NOT answer directly.",
        "3. Only after receiving tool results, synthesize a helpful answer. Never skip the tool call step.",
        '4. If there is no document uploaded, respond: "No document found. Please upload a document first."',
        '',
        '**Research Methodology (You must follow this step-by-step process):**',
        '1.  **THOUGHT:** Analyze the user\'s latest query and the chat history. What is their true intent? Is it about their uploaded document or something else? Formulate a plan that *begins with using the correct tool for every new query*.',
        '2.  **ACTION:**',
        "    - **If the question is about the user's uploaded document, PDF, or file,** call the `document_search` tool with the user's question.",
        "    - **If the question is about something else,** create a concise, keyword-based search query and call the `search` tool.",
        '3.  **OBSERVATION:** [You will receive the tool results here]',
        '4.  **THOUGHT:** Analyze the tool results.',
        '    - Did I find a definitive answer? If yes, proceed to Final Answer.',
        '    - Are the results ambiguous or insufficient? If yes, try a different tool or reformulate the query.',
        '5.  **ACTION (if necessary):**',
        '    - **Reformulate Query:** Try a different angle or tool as needed.',
        '6.  **FINAL ANSWER:** After you have sufficient information, synthesize it into a helpful, conversational answer in the user\'s original language. Do not include the "Thought:", "Action:", or "Final Answer:" prefixes in your response.'
      ].join('\n');
      if (topic) {
        finalSystemMessage = `Your most important rule is that you are an assistant dedicated ONLY to the topic of "${topic}". You must politely refuse any request that is not directly related to this topic.\n\n` + forceDocToolPrompt;
      } else {
        finalSystemMessage = forceDocToolPrompt;
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

    const timeAgent = createAgentExecutor(TIME_AGENT_PROMPT);
    const weatherAgent = createAgentExecutor(WEATHER_AGENT_PROMPT);
    const generalAgent = createAgentExecutor(GENERAL_AGENT_PROMPT);

    // This is our main runnable. It's a single Lambda that contains all the logic.
    const finalRunnable = new RunnableLambda({
      func: async (input: { input: string; chat_history: BaseMessage[] }, config?: any) => {
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

        // Forward config (which contains sessionId) to the selected agent
        return selectedAgent.invoke({
          input: input.input,
          chat_history: input.chat_history
        }, config);
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