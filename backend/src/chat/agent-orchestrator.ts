// agent-orchestrator.ts
import { AgentRegistry, AgentHandler, AgentResult } from "./agent-registry";

export class AgentOrchestrator {

  // Run agents in parallel and return all results
  static async runParallel(agentNames: string[], input: string, context: any = {}): Promise<{ [agent: string]: AgentResult }> {
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);

    // Filter out non-existent agents
    const availableAgents = agentNames.filter(name => {
      const exists = !!AgentRegistry.getAgent(name);
      if (!exists) {
        console.warn(`Agent '${name}' not found in registry. Skipping.`);
      }
      return exists;
    });

    // If no agents available, try fallback
    if (availableAgents.length === 0) {
      console.warn(`None of the requested agents exist: [${agentNames.join(', ')}]. Trying fallback agents.`);
      
      const fallbackAgent = ['general', 'web_search', 'research'].find(name => !!AgentRegistry.getAgent(name));
      
      if (fallbackAgent) {
        console.log(`Using '${fallbackAgent}' as fallback agent`);
        availableAgents.push(fallbackAgent);
      } else {
        return {
          fallback: {
            output: "I'm having trouble processing your request right now. Our agent system is experiencing issues.",
            confidence: 0
          }
        };
      }
    }

    // Execute all available agents in parallel
    const results = await Promise.allSettled(
      availableAgents.map(async (name) => {
        console.log(`AgentOrchestrator.runParallel: Processing agent '${name}'`);
        const agentHandler = AgentRegistry.getAgent(name)!;
        
        try {
          const result = await agentHandler.handle(input, context, boundCallAgent);
          return [name, result] as [string, AgentResult];
        } catch (error) {
          console.error(`Error in agent '${name}':`, error);
          return [name, {
            output: `Error processing request with agent '${name}'.`,
            confidence: 0.1
          }] as [string, AgentResult];
        }
      })
    );

    // Convert results to object, handling any rejections
    return Object.fromEntries(
      results
        .filter((result): result is PromiseFulfilledResult<[string, AgentResult]> => result.status === 'fulfilled')
        .map(result => result.value)
    );
  }

  // Run a single agent efficiently
  static async runSingleAgent(agentName: string, input: string, context: any = {}): Promise<AgentResult> {
    console.log(`AgentOrchestrator.runSingleAgent: Processing agent '${agentName}'`);

    const agentHandler = AgentRegistry.getAgent(agentName);
    if (!agentHandler) {
      console.error(`Agent '${agentName}' not found in registry`);
      throw new Error(`Agent '${agentName}' not found`);
    }

    try {
      const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
      return await agentHandler.handle(input, context, boundCallAgent);
    } catch (error) {
      console.error(`Error in agent '${agentName}':`, error);
      return {
        output: `Error processing request with agent '${agentName}'.`,
        confidence: 0.1
      };
    }
  }

  // Use pure LLM to predict the best agent for a query
  private static async predictBestAgent(input: string, availableAgents: string[], context: any = {}): Promise<{ agentName: string, confidence: number }> {
    console.log('Starting pure LLM-based agent prediction');
    
    const generalAgent = AgentRegistry.getAgent('general');
    if (!generalAgent) {
      console.warn('General agent not available for agent prediction, using fallback');
      return { 
        agentName: availableAgents.includes('research') ? 'research' : 
                  availableAgents.includes('general') ? 'general' : availableAgents[0], 
        confidence: 0.5 
      };
    }

    // Create a focused system prompt that forces JSON-only responses
    const systemPrompt = `You are a routing system. Your ONLY job is to analyze user queries and return a JSON object to route them to the correct agent.

Available agents:
${availableAgents.map(agent => `- ${agent}: ${this.getAgentDescription(agent)}`).join('\n')}

User query: "${input}"
${context.chatHistory && context.chatHistory.length > 0 ? `\nRecent conversation context: ${context.chatHistory.slice(-2).map((msg: any) => `${msg.type}: ${msg.content}`).join(', ')}` : ''}

ROUTING RULES:
- Time queries (hora, time, current time) → time or current_time agents
- Weather queries (clima, weather, temperature) → open_weather_map or weather agents  
- Document questions (about documents, uploaded files) → document_search agent
- Company/research questions → research agent
- Code questions → code_interpreter agent
- General conversation → general agent

Return ONLY this JSON format:
{"agentName": "agent_name", "confidence": 0.85, "reasoning": "why this agent"}

NO other text, explanations, or markdown. ONLY the JSON object.`;

    try {
      const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
      const result = await generalAgent.handle(
        input,
        { ...context, systemPrompt },
        boundCallAgent
      );

      console.log(`Raw LLM prediction response: ${result.output}`);

      // Try multiple JSON extraction approaches
      let jsonData: any = null;
      const responseStr = result.output || '';

      // Method 1: Direct JSON parse
      try {
        jsonData = JSON.parse(responseStr.trim());
      } catch (e) {
        // Method 2: Extract from code blocks
        const codeBlockMatch = responseStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          try {
            jsonData = JSON.parse(codeBlockMatch[1].trim());
          } catch (e2) {
            console.error('Code block JSON parse failed:', e2);
          }
        }
        
        if (!jsonData) {
          // Method 3: Find any JSON-like object with agentName
          const jsonMatch = responseStr.match(/\{[^{}]*"agentName"[^{}]*\}/);
          if (jsonMatch) {
            try {
              jsonData = JSON.parse(jsonMatch[0]);
            } catch (e3) {
              console.error('Regex JSON parse failed:', e3);
            }
          }
        }
        
        if (!jsonData) {
          // Method 4: Look for any JSON object in the response
          const anyJsonMatch = responseStr.match(/\{[\s\S]*?\}/);
          if (anyJsonMatch) {
            try {
              jsonData = JSON.parse(anyJsonMatch[0]);
              // Validate it has required fields
              if (!jsonData.agentName) {
                jsonData = null;
              }
            } catch (e4) {
              console.error('Any JSON parse failed:', e4);
            }
          }
        }
        
        if (!jsonData) {
          console.error('All JSON parsing methods failed for response:', responseStr);
        }
      }

      if (jsonData && jsonData.agentName && typeof jsonData.confidence === 'number') {
        if (availableAgents.includes(jsonData.agentName)) {
          console.log(`LLM predicted agent: ${jsonData.agentName} with confidence ${jsonData.confidence}`);
          console.log(`Reasoning: ${jsonData.reasoning || 'Not provided'}`);
          return {
            agentName: jsonData.agentName,
            confidence: jsonData.confidence
          };
        } else {
          console.warn(`LLM predicted agent ${jsonData.agentName} not in available agents`);
        }
      } else {
        console.error('Invalid prediction format:', jsonData);
      }
    } catch (error) {
      console.error('Error in LLM prediction:', error);
    }

    // Fallback when LLM prediction fails
    console.log('LLM prediction failed, using intelligent fallback');
    
    // Smart fallback based on input content
    const inputLower = input.toLowerCase();
    
    if (inputLower.includes('document') || inputLower.includes('archivo') || inputLower.includes('trata')) {
      if (availableAgents.includes('document_search')) {
        return { agentName: 'document_search', confidence: 0.6 };
      }
    }
    
    if (inputLower.includes('time') || inputLower.includes('hora')) {
      if (availableAgents.includes('time')) {
        return { agentName: 'time', confidence: 0.6 };
      }
      if (availableAgents.includes('current_time')) {
        return { agentName: 'current_time', confidence: 0.6 };
      }
    }
    
    if (inputLower.includes('weather') || inputLower.includes('clima')) {
      if (availableAgents.includes('open_weather_map')) {
        return { agentName: 'open_weather_map', confidence: 0.6 };
      }
      if (availableAgents.includes('weather')) {
        return { agentName: 'weather', confidence: 0.6 };
      }
    }
    
    // Default fallback
    return {
      agentName: availableAgents.includes('research') ? 'research' : 
                availableAgents.includes('general') ? 'general' : availableAgents[0],
      confidence: 0.5
    };
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
      console.log(`Starting confidence-based routing for input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`);
      console.log(`Available agents: ${agentNames.join(', ')}`);
      console.log(`Confidence threshold: ${threshold}`);

      // Get LLM prediction for best agent
      const prediction = await this.predictBestAgent(input, agentNames, context);
      console.log(`LLM predicted: ${prediction.agentName} (confidence: ${prediction.confidence.toFixed(2)})`);

      // High confidence prediction - try single agent first
      if (prediction.confidence >= threshold) {
        console.log(`High confidence (>= ${threshold}), running single agent: ${prediction.agentName}`);
        try {
          const singleResult = await this.runSingleAgent(prediction.agentName, input, context);
          
          // Verify result quality (basic check for meaningful output)
          if (singleResult?.output && singleResult.output.trim().length > 20) {
            console.log(`Single agent ${prediction.agentName} succeeded with high confidence`);
            return {
              agent: prediction.agentName,
              result: singleResult,
              all: { [prediction.agentName]: singleResult }
            };
          } else {
            console.log(`Single agent ${prediction.agentName} returned insufficient output, falling back to parallel`);
          }
        } catch (error) {
          console.error(`Error running predicted agent ${prediction.agentName}:`, error);
        }
      } else {
        console.log(`Lower confidence (< ${threshold}), will use parallel execution`);
      }

      // Lower confidence or fallback - run predicted + backup agent in parallel
      const backupAgent = prediction.agentName !== 'general' && agentNames.includes('general') ? 'general' : null;
      const agentsToRun = backupAgent ? [prediction.agentName, backupAgent] : [prediction.agentName];
      
      console.log(`Running agents in parallel: ${agentsToRun.join(', ')}`);
      const allResults = await this.runParallel(agentsToRun, input, context);

      // Prefer LLM prediction if it provided a valid result
      if (allResults[prediction.agentName]?.output) {
        console.log(`Using predicted agent ${prediction.agentName} result`);
        return {
          agent: prediction.agentName,
          result: allResults[prediction.agentName],
          all: allResults
        };
      }

      // Fallback to backup agent
      if (backupAgent && allResults[backupAgent]?.output) {
        console.log(`Using backup agent ${backupAgent} result`);
        return {
          agent: backupAgent,
          result: allResults[backupAgent],
          all: allResults
        };
      }

      // Last resort: use any available result
      const availableAgent = Object.keys(allResults).find(key => allResults[key]?.output);
      if (availableAgent) {
        console.log(`Using any available agent ${availableAgent} result`);
        return {
          agent: availableAgent,
          result: allResults[availableAgent],
          all: allResults
        };
      }

      throw new Error('No agent returned a result');
    } catch (error) {
      console.error('Error in routeByConfidence:', error);
      return {
        agent: 'fallback',
        result: {
          output: "I'm having trouble processing your request right now.",
          confidence: 0
        },
        all: {}
      };
    }
  }
}
