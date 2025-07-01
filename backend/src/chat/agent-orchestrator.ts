// agent-orchestrator.ts
import { AgentRegistry, AgentHandler, AgentResult } from "./agent-registry";
import { Logger } from '@nestjs/common';

export interface AgentStep {
  agent: string; // agent name
  input: (prevResult: string | undefined, context: any) => Promise<string> | string;
}

export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  // Evaluate response completeness based on content rather than just confidence
  // This applies objective criteria that works across different agent types
  private static evaluateResponseCompleteness(response: string | any, confidence: number, input: string = '', contextHistory: string[] = []): number {
    let completenessScore = 0;
    
    // Ensure response is a string
    const responseStr = typeof response === 'string' ? response : 
                       (response && typeof response.output === 'string') ? response.output : 
                       (response && typeof response.toString === 'function') ? response.toString() : '';
    
    // Special handling for simple greetings
    const isSimpleGreeting = this.isSimpleGreeting(input);
    if (isSimpleGreeting) {
      // For greetings, heavily penalize agents that return complex technical information
      if (responseStr.includes("weather") || responseStr.includes("temperature") || 
          responseStr.includes("clima") || responseStr.includes("temperatura") ||
          responseStr.includes("current time") || responseStr.includes("timezone") ||
          responseStr.includes("hora actual") || responseStr.includes("zona horaria")) {
        completenessScore -= 0.8; // Heavy penalty for weather/time responses to greetings
      }
      
      // For greetings, prefer simple conversational responses
      if (responseStr.includes("¿En qué") || responseStr.includes("How can I") ||
          responseStr.includes("What can I") || responseStr.includes("¿Cómo puedo") ||
          responseStr.length < 50) {
        completenessScore += 0.4; // Bonus for appropriate greeting responses
      }
    }
    
    // Base score from confidence
    completenessScore += confidence * 0.5; // Lower weight from confidence, more focus on content
    
    // Length-based scoring - Adjusted to better handle greeting cases
    if (responseStr.length >= 10 && responseStr.length < 300) completenessScore += 0.2;
    else if (responseStr.length >= 300 && responseStr.length < 1000) completenessScore += 0.3; // Favor more detailed responses
    else if (responseStr.length < 10) completenessScore -= 0.3;
    else if (responseStr.length > 1000) completenessScore -= 0.1; // Penalize very verbose answers
    
    // Content-based scoring - check for markers of incomplete answers
    if (responseStr.includes("I need to search") || 
        responseStr.includes("I don't have enough information") ||
        responseStr.includes("I need more information") ||
        responseStr.includes("could you clarify") ||
        responseStr.includes("I'd need to search") ||
        responseStr.includes("NEED_MORE_SEARCH")) {
      completenessScore -= 0.4;
    }
    
    // Heavy penalty for responses claiming no access to information when it's likely available
    // This especially penalizes time/general agents claiming they can't help on topics they shouldn't handle
    if (responseStr.includes("cannot directly access") ||
        responseStr.includes("sorry, I don't have access") ||
        responseStr.includes("no tengo acceso") ||
        responseStr.includes("no tengo información") ||
        responseStr.includes("mis conocimientos son limitados") ||
        responseStr.includes("I don't have information about") ||
        responseStr.includes("necesito más información") ||
        responseStr.includes("I need more information") ||
        responseStr.includes("I don't have current information") ||
        responseStr.includes("Lo siento, no tengo información")) {
      
      // Check if this is a query about news, companies, or factual information
      const isNewsQuery = input.includes("noticias") || 
                          input.includes("news") || 
                          input.includes("recent") || 
                          input.includes("latest") || 
                          input.includes("reciente") ||
                          input.includes("ultimo") ||
                          input.match(/\b202[0-5]\b/) || // Contains a year like 2020-2025
                          input.includes("caso") || 
                          input.includes("case");
      
      // Check if this is about a company or organization
      const isCompanyQuery = input.includes("company") ||
                            input.includes("empresa") ||
                            input.includes("compañía") ||
                            input.includes("organización") ||
                            input.includes("organization") ||
                            input.includes("business") ||
                            input.includes("founder") ||
                            input.includes("fundador") ||
                            input.includes("founded") ||
                            input.includes("fundó") ||
                            input.includes("fundada") ||
                            input.includes("created") ||
                            input.includes("creada") ||
                            input.includes("GBH") || // Specific company mentioned in logs
                            input.includes("Inc") ||
                            input.includes("LLC") ||
                            input.includes("Corp") ||
                            input.includes("SA");
      
      // Apply strong penalty if the response claims no info on these topics
      if (isNewsQuery || isCompanyQuery) {
        completenessScore -= 0.8; // Even stronger penalty for claiming no access on these topics
      } else {
        completenessScore -= 0.4; // Standard penalty for "no info" responses on other topics
      }
    }
    
    // Check for special conversational indicators with stronger bonus
    if ((responseStr.includes("¡Hola") || responseStr.includes("Hello") || 
         responseStr.includes("Hi there") || responseStr.includes("Greetings") ||
         responseStr.includes("Bienvenido") || responseStr.includes("Welcome")) && 
        responseStr.length < 100) {
      // Greeting responses should get a bonus for simple greeting inputs
      completenessScore += 0.2; // Increased from 0.15 to give more weight to greetings
    }
    
    // Give strong bonus to responses that seem informative and factual (likely from research agent)
    if ((responseStr.includes("according to") || 
         responseStr.includes("based on research") || 
         responseStr.includes("specializes in") || 
         responseStr.includes("founded in") ||
         responseStr.includes("was founded") ||
         responseStr.includes("was established") ||
         responseStr.includes("was created") ||
         responseStr.match(/in \d{4}/) // Year pattern
        ) && 
        responseStr.length > 100) {
      // Factual, researched responses should get a stronger bonus
      completenessScore += 0.25;
    }
    
    // Check if response actually contains clear facts (useful for research agent)
    if ((responseStr.match(/\b\d{4}\b/) || // Contains a year
         responseStr.match(/\$[\d,]+/) || // Contains a dollar amount
         responseStr.includes("located in") || 
         responseStr.includes("headquarters") ||
         responseStr.includes("CEO") ||
         responseStr.includes("founder")) &&
        responseStr.length > 120) {
      completenessScore += 0.2; // Bonus for concrete facts
    }
    
    // Detect follow-up answers in context (like answering "by who?" after talking about a company)
    if (input && input.length < 25 && contextHistory.length > 0) {
      const lastContext = contextHistory[contextHistory.length - 1] || '';
      const previousContext = contextHistory.length > 1 ? contextHistory[contextHistory.length - 2] || '' : '';
      
      // Check if this is likely a follow-up question
      if ((input.includes("who") || input.includes("what") || input.includes("when") || input.includes("where") || 
           input.includes("how") || input.includes("why") || input.includes("which") ||
           input.includes("look it up") || input.includes("tell me more") || input.includes("more info")) &&
           (previousContext.includes("founded") || previousContext.includes("created") || 
            previousContext.includes("established") || previousContext.includes("started"))) {
        
        // Specific follow-up about entities mentioned before
        if ((lastContext.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/) || // Proper names
            lastContext.includes("GBH") || lastContext.includes("company") || lastContext.includes("business")) &&
            responseStr.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/)) { // Response has proper names
          completenessScore += 0.3; // Strong bonus for appropriate follow-up answers
        }
      }
    }
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, completenessScore));
  }

  // Run a sequence of agents, passing results between them
  static async runSteps(steps: AgentStep[], context: any = {}): Promise<{ results: AgentResult[] }> {
    let prevResult: string | undefined = undefined;
    const results: AgentResult[] = [];
    
    // Create a properly bound version of callAgent
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
    
    for (const step of steps) {
      console.log(`AgentOrchestrator.runSteps: Processing step for agent '${step.agent}'`);
      const agentHandler = AgentRegistry.getAgent(step.agent);
      
      if (!agentHandler) {
        console.error(`Agent '${step.agent}' not found in registry`);
        throw new Error(`Agent '${step.agent}' not found`);
      }
      
      const input = await step.input(prevResult, context);
      const result = await agentHandler.handle(input, context, boundCallAgent);
      results.push(result);
      prevResult = result.output;
    }
    return { results };
  }

  // Example: run agents in parallel (returns all results)
  static async runParallel(agentNames: string[], input: string, context: any = {}): Promise<{ [agent: string]: AgentResult }> {
    // Create a properly bound version of callAgent
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
    
    // Filter out agent names that don't exist in the registry to avoid errors
    const availableAgents = agentNames.filter(name => {
      const exists = !!AgentRegistry.getAgent(name);
      if (!exists) {
        console.warn(`Agent '${name}' not found in registry. Skipping.`);
      }
      return exists;
    });
    
    // If no agents are available after filtering, use 'fallback' or 'general' agent
    if (availableAgents.length === 0) {
      console.warn(`None of the requested agents exist: [${agentNames.join(', ')}]. Trying fallback agents.`);
      
      // Check for general or web_search as fallback options
      const fallbackOptions = ['general', 'web_search', 'research'];
      const fallbackAgent = fallbackOptions.find(name => !!AgentRegistry.getAgent(name));
      
      if (fallbackAgent) {
        console.log(`Using '${fallbackAgent}' as fallback agent`);
        availableAgents.push(fallbackAgent);
      } else {
        console.error('No fallback agents available. Returning error message.');
        return { 
          fallback: { 
            output: "I'm having trouble processing your request right now. Our agent system is experiencing issues.", 
            confidence: 0 
          } 
        };
      }
    }
    
    const promises = availableAgents.map(async (name) => {
      console.log(`AgentOrchestrator.runParallel: Processing agent '${name}'`);
      const agentHandler = AgentRegistry.getAgent(name);
      
      try {
        // We've already verified this agent exists in our filter above
        const handler = agentHandler!; // Use non-null assertion since we've already checked
        return [name, await handler.handle(input, context, boundCallAgent)] as [string, AgentResult];
      } catch (error) {
        console.error(`Error in agent '${name}':`, error);
        return [name, { 
          output: `Error processing request with agent '${name}'.`, 
          confidence: 0.1 
        }] as [string, AgentResult];
      }
    });
    
    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  }

  // Helper method to run a single agent (more efficient than runParallel with one agent)
  static async runSingleAgent(agentName: string, input: string, context: any = {}): Promise<AgentResult> {
    console.log(`AgentOrchestrator.runSingleAgent: Processing agent '${agentName}'`);
    
    // Create a properly bound version of callAgent
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
    const agentHandler = AgentRegistry.getAgent(agentName);
    
    if (!agentHandler) {
      console.error(`Agent '${agentName}' not found in registry`);
      throw new Error(`Agent '${agentName}' not found`);
    }
    
    try {
      return await agentHandler.handle(input, context, boundCallAgent);
    } catch (error) {
      console.error(`Error in agent '${agentName}':`, error);
      return { 
        output: `Error processing request with agent '${agentName}'.`, 
        confidence: 0.1 
      };
    }
  }

  // Use LLM to predict the best agent for a query
  private static async predictBestAgent(input: string, availableAgents: string[], context: any = {}): Promise<{agentName: string, confidence: number}> {
    // Ensure we have the general agent available for this prediction
    const generalAgent = AgentRegistry.getAgent('general');
    if (!generalAgent) {
      console.warn('General agent not available for agent prediction');
      return { agentName: availableAgents[0] || 'general', confidence: 0.5 };
    }

    // Create a properly bound version of callAgent
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
    
    // Create a system prompt to help the LLM understand the task
    const systemPrompt = `You are an expert agent router. Your task is to analyze the user's query and determine which specialized agent would be best suited to handle it.

Available agents:
${availableAgents.map(agent => `- ${agent}: ${this.getAgentDescription(agent)}`).join('\n')}

CRITICAL ROUTING RULES:

1. For WEATHER queries (HIGHEST PRIORITY):
   - Route to 'open_weather_map' or 'weather' agent for ANY weather-related question
   - Keywords: clima, weather, temperature, temperatura, rain, lluvia, forecast, pronóstico, conditions, condiciones
   - Examples: "como esta el clima", "what's the weather", "temperatura en", "weather in"
   - Confidence should be HIGH (0.9) for weather queries

2. For simple greetings (like "Hola", "Hello", "Hi", "Buenos días", etc.):
   - ALWAYS route to 'general' agent
   - NEVER route to specialized agents like 'weather', 'time', or 'research' for basic greetings
   - Confidence should be HIGH (0.8-0.9) for clear greetings

3. For document-related queries:
   - Route to 'document_search' agent if available for ANY document-related question
   - Examples: "what is this document about?", "according to the document", "summarize the document"
   - Also consider context: if previous messages mention document uploads
   - Confidence should be HIGH (0.8-0.95) for document queries

4. For time queries (explicitly asking for current time, date, timezone):
   - Route to 'time' or 'current_time' agent only if the query clearly mentions time-related terms
   - Examples: "What time is it?", "Current time in New York", "qué hora es"
   - Do NOT route time queries for weather-related "tiempo" in Spanish

5. For company/business/factual information queries:
   - Route to 'research' agent if available
   - Examples: "Who founded Apple?", "What does Microsoft do?"

6. Context Awareness:
   - Analyze conversation history for document mentions, uploads, or previous document discussions
   - Consider pronouns and implicit references in context

Based on the query and conversation context, respond with a JSON object containing:
1. "agentName": The name of the most appropriate agent from the available list
2. "confidence": A number between 0-1 representing your confidence in this selection (use 0.9 for weather queries)
3. "reasoning": A brief explanation of why you selected this agent

Only respond with the JSON object, nothing else.`;

    try {
      // Call the general agent with the system prompt to get the prediction
      const result = await generalAgent.handle(
        `Query: ${input}\n\nAnalyze this query and select the most appropriate agent.`, 
        { 
          ...context,
          systemPrompt // Pass the system prompt to guide the agent's response
        }, 
        boundCallAgent
      );
      
      // Parse the result to extract the agent prediction
      const responseStr = result.output || '';
      
      // Extract JSON from the response (it might be wrapped in code blocks or have explanatory text)
      const jsonMatch = responseStr.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const predictionData = JSON.parse(jsonMatch[0]);
          
          // Validate the prediction data
          if (predictionData.agentName && typeof predictionData.confidence === 'number') {
            // Ensure the predicted agent is in our available list
            if (availableAgents.includes(predictionData.agentName)) {
              console.log(`LLM predicted agent: ${predictionData.agentName} with confidence ${predictionData.confidence}`);
              console.log(`Reasoning: ${predictionData.reasoning || 'Not provided'}`);
              return {
                agentName: predictionData.agentName,
                confidence: predictionData.confidence
              };
            } else {
              console.warn(`LLM predicted agent ${predictionData.agentName} not in available agents`);
            }
          }
        } catch (parseError) {
          console.error('Failed to parse LLM agent prediction:', parseError);
        }
      }
      
      // Enhanced agent name extraction from text response
      // Look for specific weather agent mentions first
      const weatherAgentMatch = responseStr.match(/`(open_weather_map|weather)`|(?:open_weather_map|weather)\b/i);
      if (weatherAgentMatch) {
        const predictedAgent = weatherAgentMatch[1] || weatherAgentMatch[0].toLowerCase();
        if (availableAgents.includes(predictedAgent)) {
          console.log(`LLM predicted weather agent from text: ${predictedAgent} with confidence 0.9`);
          return {
            agentName: predictedAgent,
            confidence: 0.9 // High confidence for explicit weather agent mentions
          };
        }
      }
      
      // General agent name extraction
      const agentNameMatch = responseStr.match(/`([^`]+)`|(\w+) agent/i);
      if (agentNameMatch) {
        const predictedAgent = agentNameMatch[1] || agentNameMatch[2];
        if (availableAgents.includes(predictedAgent)) {
          console.log(`LLM predicted agent from text: ${predictedAgent} with confidence 0.8`);
          return {
            agentName: predictedAgent,
            confidence: 0.8
          };
        }
      }
      
      // Check for specific mentions of document_search in response
      if (responseStr.includes('document_search') && availableAgents.includes('document_search')) {
        console.log(`LLM mentioned document_search agent, using it with confidence 0.9`);
        return {
          agentName: 'document_search',
          confidence: 0.9
        };
      }
      
      // Fallback classification if parsing fails
      const queryTypes = this.classifyQueryType(input);
      for (const type of queryTypes) {
        // Map query types to likely agents
        if (type === 'time' && availableAgents.includes('time')) {
          return { agentName: 'time', confidence: 0.7 };
        }
        if ((type === 'news' || type === 'factual') && availableAgents.includes('research')) {
          return { agentName: 'research', confidence: 0.8 }; // Higher confidence for research
        }
      }
      
      // If all else fails, default to general or first available
      return { 
        agentName: availableAgents.includes('general') ? 'general' : availableAgents[0], 
        confidence: 0.5
      };
    } catch (error) {
      console.error('Error predicting best agent:', error);
      return { 
        agentName: availableAgents.includes('general') ? 'general' : availableAgents[0], 
        confidence: 0.5
      };
    }
  }
  
  // Get a description of each agent for the LLM to understand its purpose
  private static getAgentDescription(agentName: string): string {
    const descriptions: Record<string, string> = {
      'general': 'A general-purpose conversational agent that can handle a wide range of topics but has limited access to specific or real-time information.',
      'web_search': 'Specializes in finding current information, news articles, and recent events by searching the web. NOTE: The research agent is preferred over this one.',
      'research': 'Focuses on providing detailed factual information by searching the web and analyzing results. Handles company information, news, recent events, people, historical events, and other knowledge-based topics. This is the preferred agent for all factual queries.',
      'time': 'Provides current time, date, and timezone information.',
      'current_time': 'Provides current time, date, and timezone information.',
      'weather': 'CRITICAL: Provides weather forecasts and current conditions for specific locations. Use this agent for ANY weather-related query including "clima", "weather", "temperature", "temperatura", "forecast", "pronóstico", etc.',
      'open_weather_map': 'CRITICAL: Provides detailed weather information using OpenWeatherMap data. PREFERRED weather agent. Use this agent for ANY weather-related query including "clima", "weather", "temperature", "temperatura", "forecast", "pronóstico", etc.',
      'document_search': 'CRITICAL: Searches through user-uploaded documents to find specific information. Use this agent for ANY query that asks about documents, uploaded files, or content within documents. This includes questions like "what is this document about?", "what details does it have?", "according to the document", etc. This agent has access to the user\'s uploaded documents.',
      'summarizer': 'Summarizes long pieces of text or content.',
      'code_interpreter': 'Analyzes, explains, and executes code snippets.',
      'code_optimization': 'Optimizes and improves existing code.'
    };
    
    return descriptions[agentName] || `Agent that handles ${agentName}-related queries`;
  }

  // Confidence-based routing: use LLM to predict best agent, then run it and verify
  static async routeByConfidence(agentNames: string[], input: string, context: any = {}, threshold = 0.7): Promise<{ agent: string, result: AgentResult, all: { [agent: string]: AgentResult } }> {
    try {
      console.log(`Starting confidence-based routing for input: "${input.substring(0, 30)}${input.length > 30 ? '...' : ''}"`);
      console.log(`Considering ${agentNames.length} agents: ${agentNames.join(', ')}`);
      
      // Extract conversation history for context-aware decision making
      const chatHistory: string[] = [];
      if (context && context.chatHistory && Array.isArray(context.chatHistory)) {
        context.chatHistory.forEach((msg: any) => {
          // Try multiple extraction paths for different message structures
          let content = '';
          
          // Path 1: Standard MongoDB structure (msg.kwargs._doc.content)
          if (msg && msg.kwargs && msg.kwargs._doc && msg.kwargs._doc.content) {
            content = msg.kwargs._doc.content;
          }
          // Path 2: LangChain structure (msg.kwargs.$__parent.data.content)
          else if (msg && msg.kwargs && msg.kwargs.$__parent && msg.kwargs.$__parent.data && msg.kwargs.$__parent.data.content) {
            content = msg.kwargs.$__parent.data.content;
          }
          // Path 3: Direct content property
          else if (msg && msg.content) {
            content = msg.content;
          }
          // Path 4: Data content property
          else if (msg && msg.data && msg.data.content) {
            content = msg.data.content;
          }
          
          if (content && typeof content === 'string') {
            chatHistory.push(content);
          }
        });
      }

      // Check for document context in the conversation 
      const hasDocumentContext = this.hasDocumentContextInHistory(chatHistory);
      console.log(`Document context check: hasDocumentContext=${hasDocumentContext}, chatHistory=${JSON.stringify(chatHistory)}`);
      console.log(`Is document query: ${this.isDocumentRelatedQuery(input, chatHistory)}`);
      console.log(`Available agents include document_search: ${agentNames.includes('document_search')}`);
      
      // PRIORITY 1: If we detect document context AND document-related query, use document_search
      if (hasDocumentContext && this.isDocumentRelatedQuery(input, chatHistory) && agentNames.includes('document_search')) {
        console.log(`Detected document-related query with context: "${input}" - using document_search agent directly`);
        try {
          const result = await this.runSingleAgent('document_search', input, context);
          return {
            agent: 'document_search',
            result: result,
            all: { 'document_search': result }
          };
        } catch (error) {
          console.error('Error running document_search agent:', error);
        }
      }
      
      // PRIORITY 2: Fallback - if no chat history but query is clearly document-related, 
      // try document_search anyway (this covers upload scenarios)
      if (chatHistory.length <= 1 && this.isDocumentRelatedQuery(input, []) && agentNames.includes('document_search')) {
        console.log(`No chat history but document-related query detected: "${input}" - trying document_search agent`);
        try {
          const result = await this.runSingleAgent('document_search', input, context);
          
          // Only use this result if it's not an error or "no document found" type response
          if (result && result.output && result.output.length > 50 && 
              !result.output.includes('no document') && 
              !result.output.includes('cannot find') &&
              !result.output.includes('no information')) {
            console.log(`Document search fallback succeeded for: "${input}"`);
            return {
              agent: 'document_search',
              result: result,
              all: { 'document_search': result }
            };
          } else {
            console.log(`Document search fallback failed or returned insufficient result, continuing with normal routing`);
          }
        } catch (error) {
          console.error('Error in document_search fallback:', error);
        }
      }
      
      // Determine if this is a follow-up to a fact-based question
      const isFactBasedFollowup = this.isFactualFollowUpQuery(input, chatHistory);
      if (isFactBasedFollowup && agentNames.includes('research')) {
        console.log(`Detected fact-based follow-up question: "${input}"`);
      }
      
      // Get initial query classification for logging
      const queryTypes = this.classifyQueryType(input);
      console.log(`Query classified as: ${queryTypes.join(', ')}`);
      
      // PRIORITY WEATHER DETECTION: Direct routing for weather queries
      if (queryTypes.includes('weather')) {
        console.log(`Direct weather query detected: "${input}"`);
        
        // Try open_weather_map first, then weather agent
        const preferredWeatherAgent = agentNames.includes('open_weather_map') ? 'open_weather_map' : 
                                     agentNames.includes('weather') ? 'weather' : null;
        
        if (preferredWeatherAgent) {
          console.log(`Using weather agent directly: ${preferredWeatherAgent}`);
          try {
            const weatherResult = await this.runSingleAgent(preferredWeatherAgent, input, context);
            return {
              agent: preferredWeatherAgent,
              result: weatherResult,
              all: { [preferredWeatherAgent]: weatherResult }
            };
          } catch (error) {
            console.error(`Error running weather agent ${preferredWeatherAgent}:`, error);
            // Fall through to LLM prediction if weather agent fails
          }
        }
      }
      
      // Get LLM prediction for best agent
      const prediction = await this.predictBestAgent(input, agentNames, context);
      console.log(`LLM predicted best agent: ${prediction.agentName} with confidence ${prediction.confidence}`);
      
      // Special handling for simple greetings - force general agent
      if (this.isSimpleGreeting(input)) {
        console.log(`Detected simple greeting: "${input}" - forcing general agent`);
        if (agentNames.includes('general')) {
          try {
            const generalResult = await this.runSingleAgent('general', input, context);
            return {
              agent: 'general',
              result: generalResult,
              all: { 'general': generalResult }
            };
          } catch (error) {
            console.error('Error running general agent for greeting:', error);
          }
        }
      }
      
      // Use LLM prediction with high confidence (>= 0.6) to select single agent
      if (prediction.confidence >= 0.6) {
        console.log(`High confidence LLM prediction (${prediction.confidence}), using single agent: ${prediction.agentName}`);
        
        try {
          const singleAgentResult = await this.runSingleAgent(prediction.agentName, input, context);
          
          // Verify the result is reasonable
          if (singleAgentResult && singleAgentResult.output && singleAgentResult.output.length > 10) {
            console.log(`Single agent ${prediction.agentName} provided good result`);
            return {
              agent: prediction.agentName,
              result: singleAgentResult,
              all: { [prediction.agentName]: singleAgentResult }
            };
          } else {
            console.log(`Single agent ${prediction.agentName} result was insufficient, falling back to general`);
          }
        } catch (error) {
          console.error(`Error running predicted agent ${prediction.agentName}:`, error);
        }
      }
      
      // For medium confidence (0.4-0.6) or fallback, run predicted agent + general as backup
      let agentsToRun: string[] = [prediction.agentName];
      if (prediction.agentName !== 'general' && agentNames.includes('general')) {
        agentsToRun.push('general');
      }
      
      console.log(`Medium confidence or fallback, running minimal agents: ${agentsToRun.join(', ')}`);
      
      // Run selected agents and collect their results
      const allResults = await this.runParallel(agentsToRun, input, context);
      
      // Log confidence scores for debugging
      console.log(`Agent results:`, 
        Object.entries(allResults).map(([name, result]) => 
          `${name}: confidence ${result.confidence ?? 'undefined'}, output length ${(result.output || '').length}`));
      
      // Trust the LLM prediction first
      if (allResults[prediction.agentName]) {
        const predictedResult = allResults[prediction.agentName];
        console.log(`Using LLM-predicted agent: ${prediction.agentName}`);
        return {
          agent: prediction.agentName,
          result: predictedResult,
          all: allResults
        };
      }
      
      // Fallback to general agent if available
      if (allResults['general']) {
        console.log(`Falling back to general agent`);
        return {
          agent: 'general',
          result: allResults['general'],
          all: allResults
        };
      }
      
      // Last resort: use any available agent
      const availableAgent = Object.keys(allResults)[0];
      if (availableAgent) {
        console.log(`Last resort: using ${availableAgent} agent`);
        return {
          agent: availableAgent,
          result: allResults[availableAgent],
          all: allResults
        };
      }
      
      console.error('No agent returned a result');
      throw new Error('No agent returned a result');
    } catch (error) {
      console.error('Error in routeByConfidence:', error);
      // Return a default response in case of error
      const fallbackResult: AgentResult = { 
        output: "I'm having trouble processing your request right now.",
        confidence: 0 
      };
      return { 
        agent: 'fallback', 
        result: fallbackResult, 
        all: { fallback: fallbackResult } 
      };
    }
  }
  
  // Classify the query type to determine which agents should handle it
  private static classifyQueryType(input: string): string[] {
    const queryTypes: string[] = [];
    const lowercaseInput = input.toLowerCase();
    
    // Check for weather queries (HIGH PRIORITY)
    if (lowercaseInput.includes('clima') ||
        lowercaseInput.includes('weather') ||
        lowercaseInput.includes('temperature') ||
        lowercaseInput.includes('temperatura') ||
        lowercaseInput.includes('rain') ||
        lowercaseInput.includes('lluvia') ||
        lowercaseInput.includes('sun') ||
        lowercaseInput.includes('sol') ||
        lowercaseInput.includes('wind') ||
        lowercaseInput.includes('viento') ||
        lowercaseInput.includes('forecast') ||
        lowercaseInput.includes('pronóstico') ||
        lowercaseInput.includes('pronostico') ||
        lowercaseInput.includes('conditions') ||
        lowercaseInput.includes('condiciones') ||
        lowercaseInput.match(/how.*hot|how.*cold|qué.*calor|qué.*frío/i) ||
        lowercaseInput.match(/como.*esta.*clima|how.*weather/i)) {
      queryTypes.push('weather');
    }
    
    // Check for news/current events queries
    if (lowercaseInput.includes('news') || 
        lowercaseInput.includes('noticias') || 
        lowercaseInput.includes('current events') || 
        lowercaseInput.includes('recent') || 
        lowercaseInput.includes('latest') ||
        lowercaseInput.includes('reciente') ||
        lowercaseInput.includes('ultimo') ||
        lowercaseInput.match(/\b202[0-5]\b/) || // Years 2020-2025
        lowercaseInput.includes('today') ||
        lowercaseInput.includes('yesterday') ||
        lowercaseInput.includes('this week') ||
        lowercaseInput.includes('this month') ||
        lowercaseInput.includes('caso') || 
        lowercaseInput.includes('case')) {
      queryTypes.push('news');
    }
    
    // Check for time-specific queries (but not weather-related "tiempo")
    if ((lowercaseInput.includes('time') ||
        lowercaseInput.includes('hora') ||
        lowercaseInput.includes('clock') ||
        lowercaseInput.includes('current time') ||
        lowercaseInput.includes('what time') ||
        lowercaseInput.includes('date today') ||
        lowercaseInput.includes('today\'s date') ||
        lowercaseInput.includes('day of the week') ||
        lowercaseInput.includes('timezone') ||
        lowercaseInput.includes('qué hora')) &&
        !queryTypes.includes('weather')) { // Don't classify as time if already weather
      queryTypes.push('time');
    }
    
    // Check for factual/research queries
    if (lowercaseInput.includes('who is') ||
        lowercaseInput.includes('what is') ||
        lowercaseInput.includes('when was') ||
        lowercaseInput.includes('where is') ||
        lowercaseInput.includes('why did') ||
        lowercaseInput.includes('how does') ||
        lowercaseInput.includes('history of') ||
        lowercaseInput.includes('tell me about') ||
        lowercaseInput.includes('information about') ||
        lowercaseInput.includes('definition of') ||
        lowercaseInput.includes('meaning of') ||
        lowercaseInput.includes('facts about') ||
        lowercaseInput.includes('founded') ||
        lowercaseInput.includes('established') ||
        lowercaseInput.includes('created')) {
      queryTypes.push('factual');
    }
    
    // If no specific type was detected, mark as general
    if (queryTypes.length === 0) {
      queryTypes.push('general');
    }
    
    return queryTypes;
  }

  // Helper method to detect if a query is a fact-based follow-up
  // Detect if a query is related to companies, organizations, or businesses
  private static isCompanyRelatedQuery(input: string): boolean {
    const lowercaseInput = input.toLowerCase();
    
    // Check for company-related keywords
    const companyKeywords = [
      'company', 'empresa', 'compañía', 'organización', 'organization',
      'business', 'negocio', 'corporation', 'corporación', 'inc', 'llc',
      'founder', 'fundador', 'founded', 'fundó', 'fundada', 'created',
      'creada', 'established', 'establecida', 'ceo', 'president', 'presidente',
      'headquarters', 'sede', 'based in', 'ubicada en', 'industry', 'industria',
      'product', 'producto', 'service', 'servicio', 'employee', 'empleado',
      'market', 'mercado', 'revenue', 'ingreso', 'profit', 'beneficio',
      'startup', 'brand', 'marca', 'director', 'founder', 'fundador'
    ];
    
    // Check if any company keywords are in the input
    if (companyKeywords.some(keyword => lowercaseInput.includes(keyword))) {
      return true;
    }
    
    // Check for patterns that look like company queries
    // E.g., "Who founded X", "When was X founded", etc.
    const companyPatterns = [
      /who (founded|created|started|established|owns|runs)/i,
      /when was .{3,50} (founded|created|started|established)/i,
      /where is .{3,50} (located|based|headquartered)/i,
      /what (does|is) .{3,50} (do|make|sell|offer)/i,
      /quién (fundó|creó|estableció|inició)/i,
      /cuándo (se fundó|fue fundada|se creó|fue creada|se estableció)/i,
      /dónde (está ubicada|se encuentra|tiene su sede)/i
    ];
    
    if (companyPatterns.some(pattern => input.match(pattern))) {
      return true;
    }
    
    // Check for company names in the input (common naming patterns)
    // This helps catch "What is Soluciones GBH" type queries
    const companyNamePatterns = [
      /\b[A-Z][a-z]+ (Inc|LLC|Corp|Company|Corporation|Group)\b/,
      /\b[A-Z][a-z]+ & [A-Z][a-z]+\b/, // Like "Johnson & Johnson"
      /\b[A-Z]{2,5}\b/, // Acronyms like "IBM", "GBH"
      /\bSoluciones GBH\b/i // Specific company mentioned in logs
    ];
    
    if (companyNamePatterns.some(pattern => input.match(pattern))) {
      return true;
    }
    
    return false;
  }
  
  private static isFactualFollowUpQuery(input: string, contextHistory: string[] = []): boolean {
    if (input.length > 35) return false; // Follow-up questions tend to be short
    
    const followUpPatterns = [
      /^(and|but|so|then|what about|how about|by whom|by who|who by)/i,
      /^(where|when|why|how|which|what|who)/i,
      /look it up/i, 
      /tell me more/i, 
      /more (info|information|details)/i,
      /^founded by/i,
      /^created by/i,
      /^established by/i,
    ];
    
    // Check for follow-up patterns
    if (followUpPatterns.some(pattern => input.match(pattern)) && contextHistory.length >= 2) {
      // Check if previous context contains factual information
      const previousMessages = contextHistory.slice(-3);
      for (const msg of previousMessages) {
        if (msg && (
          msg.includes("founded") ||
          msg.includes("established") ||
          msg.includes("created") ||
          msg.includes("company") ||
          msg.includes("organization") ||
          msg.includes("business") ||
          msg.match(/in \d{4}/) // Contains a year
        )) {
          return true;
        }
      }
    }
    
    // Very short inputs that could be follow-ups to factual queries
    if (input.length < 15 && input.match(/^(who|what|when|where|why|how|which)/) && contextHistory.length > 0) {
      return true;
    }
    
    // Special case for "look it up" type queries
    if ((input.includes("look it up") || 
         input.includes("search for it") || 
         input.includes("find out") ||
         input.includes("tell me") ||
         input.includes("check it")) && 
        contextHistory.length > 0) {
      return true;
    }
    
    return false;
  }

  // Helper method to detect simple greetings
  private static isSimpleGreeting(input: string): boolean {
    const trimmedInput = input.trim().toLowerCase();
    
    // Common greetings in various languages
    const greetings = [
      'hola', 'hello', 'hi', 'hey', 'buenos días', 'buenas tardes', 'buenas noches',
      'good morning', 'good afternoon', 'good evening', 'good night',
      'howdy', 'what\'s up', 'qué tal', 'que tal', 'cómo estás', 'como estas',
      'how are you', 'salut', 'bonjour', 'bonsoir', 'guten tag', 'guten morgen',
      'konnichiwa', 'ohayo', 'こんにちは', 'おはよう', 'oi', 'olá', 'ola'
    ];
    
    // Check if the input is just a greeting (with optional punctuation)
    const cleanInput = trimmedInput.replace(/[!?.,]/g, '');
    
    return greetings.includes(cleanInput) || 
           greetings.some(greeting => cleanInput === greeting) ||
           (cleanInput.length <= 15 && greetings.some(greeting => cleanInput.startsWith(greeting)));
  }

  // Helper method to check if conversation history contains document context
  private static hasDocumentContextInHistory(chatHistory: string[]): boolean {
    if (chatHistory.length === 0) return false;
    
    // Look for document-related mentions in recent history
    const recentHistory = chatHistory.slice(-5); // Check last 5 messages
    
    for (const message of recentHistory) {
      if (message && (
        message.includes('[PDF Uploaded]') ||
        message.includes('document') ||
        message.includes('PDF') ||
        message.includes('file') ||
        message.includes('uploaded') ||
        message.includes('attachment') ||
        message.toLowerCase().includes('documento') ||
        message.toLowerCase().includes('archivo')
      )) {
        return true;
      }
    }
    
    return false;
  }

  // Helper method to detect if a query is document-related
  private static isDocumentRelatedQuery(input: string, chatHistory: string[] = []): boolean {
    const lowercaseInput = input.toLowerCase();
    
    // Direct document references
    const directDocumentKeywords = [
      'document', 'documento', 'pdf', 'file', 'archivo',
      'uploaded', 'attachment', 'paper', 'texto'
    ];
    
    if (directDocumentKeywords.some(keyword => lowercaseInput.includes(keyword))) {
      return true;
    }
    
    // Document-related question patterns
    const documentQuestionPatterns = [
      /what.*this.*about/i,
      /what.*document.*about/i,
      /de que.*trata/i,
      /de qué.*trata/i,
      /qué.*trata/i,
      /trata.*este.*documento/i,
      /según.*documento/i,
      /according.*document/i,
      /what.*details.*it.*have/i,
      /what.*details.*does.*have/i,
      /qué.*detalles.*tiene/i,
      /summarize.*this/i,
      /resume.*esto/i,
      /tell.*me.*about.*this/i,
      /what.*contains/i,
      /what.*says/i,
      /qué.*dice/i,
      /what.*information/i,
      /qué.*información/i,
      /what.*is.*this/i,
      /qué.*es.*esto/i
    ];
    
    if (documentQuestionPatterns.some(pattern => input.match(pattern))) {
      return true;
    }
    
    // Context-based detection: pronouns with document context
    if (this.hasDocumentContextInHistory(chatHistory)) {
      const contextualPronouns = [
        /^what.*it/i,
        /^what.*this/i,
        /^what.*does.*it/i,
        /^what.*details/i,
        /^tell.*me.*about/i,
        /^qué.*tiene/i,
        /^de.*qué/i,
        /^sobre.*qué/i,
        /^what.*about/i
      ];
      
      if (contextualPronouns.some(pattern => input.match(pattern))) {
        return true;
      }
      
      // Very short questions that likely refer to context
      if (input.length < 30 && (
        lowercaseInput.includes('what') ||
        lowercaseInput.includes('qué') ||
        lowercaseInput.includes('details') ||
        lowercaseInput.includes('detalles') ||
        lowercaseInput.includes('about') ||
        lowercaseInput.includes('sobre')
      )) {
        return true;
      }
    }
    
    return false;
  }
}
