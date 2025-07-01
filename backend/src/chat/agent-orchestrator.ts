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
        responseStr.includes("NEED_MORE_SEARCH") ||
        responseStr.includes("cannot directly access") ||
        responseStr.includes("sorry, I don't have access")) {
      completenessScore -= 0.4;
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

  // Confidence-based routing: run all agents and select based on confidence
  static async routeByConfidence(agentNames: string[], input: string, context: any = {}, threshold = 0.7): Promise<{ agent: string, result: AgentResult, all: { [agent: string]: AgentResult } }> {
    try {
      console.log(`Starting confidence-based routing for input: "${input.substring(0, 30)}${input.length > 30 ? '...' : ''}"`);
      console.log(`Considering ${agentNames.length} agents: ${agentNames.join(', ')}`);
      
      // Extract conversation history for context-aware decision making
      const chatHistory: string[] = [];
      if (context && context.chatHistory && Array.isArray(context.chatHistory)) {
        context.chatHistory.forEach((msg: any) => {
          if (msg && msg.kwargs && msg.kwargs._doc && msg.kwargs._doc.content) {
            chatHistory.push(msg.kwargs._doc.content);
          }
        });
      }
      
      // LLM-based confidence check - Try the general agent first and use it if confident enough
      // This avoids running all agents for simple/common inputs
      if (agentNames.includes('general')) {
        const generalAgent = AgentRegistry.getAgent('general');
        if (generalAgent) {
          const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
          const generalResult = await generalAgent.handle(input, context, boundCallAgent);
          
          // If general agent is sufficiently confident, use it directly
          // This is an optimization that avoids running all agents when the general agent is confident
          const generalConfidenceThreshold = 0.75; // Higher threshold than default to ensure quality
          
          // Check if this is likely a simple greeting or conversational input
          const isLikelySimpleConversation = 
            input.trim().length < 25 || // Short inputs
            input.trim().split(/\s+/).length < 7 || // Few words
            !input.includes('?'); // Not a question
            
          // For simple conversational inputs, we can use a lower threshold
          const effectiveThreshold = isLikelySimpleConversation ? 0.7 : generalConfidenceThreshold;
          
          // Check if the response looks complete based on its characteristics
          const responseCompletenessScore = this.evaluateResponseCompleteness(
            generalResult.output, 
            generalResult.confidence ?? 0, 
            input,
            chatHistory
          );
          
          const responseSeemsSufficient = responseCompletenessScore >= 0.7;
          
          if ((generalResult.confidence ?? 0) >= effectiveThreshold && responseSeemsSufficient) {
            console.log(`General agent has high confidence (${generalResult.confidence}), using directly without consulting other agents`);
            return {
              agent: 'general',
              result: generalResult,
              all: { general: generalResult }
            };
          }
        }
      }
      
      // Check if this is a follow-up to a fact-based question
      const isFactBasedFollowup = this.isFactualFollowUpQuery(input, chatHistory);
      
      // If this is likely a fact-based follow-up and we have a research agent, 
      // prioritize using the research agent
      if (isFactBasedFollowup && agentNames.includes('research')) {
        console.log(`Detected fact-based follow-up question: "${input}"`);
      }
      
      // Run all agents in parallel and collect their results
      const allResults = await this.runParallel(agentNames, input, context);
      
      // Log confidence scores for debugging
      console.log(`AgentOrchestrator confidence scores:`, 
        Object.entries(allResults).map(([name, result]) => 
          `${name}: ${result.confidence ?? 'undefined'}`));
      
      // Calculate completeness scores for better comparison
      const completenessScores = Object.entries(allResults).map(([name, result]) => {
        const completeness = this.evaluateResponseCompleteness(
          result.output, 
          result.confidence ?? 0,
          input,
          chatHistory
        );
        return { name, result, completeness };
      });
      
      // Sort by completeness score
      completenessScores.sort((a, b) => b.completeness - a.completeness);
      
      console.log(`Completeness scores:`, 
        completenessScores.map(c => `${c.name}: ${c.completeness.toFixed(2)}`));
      
      // Special handling for fact-based follow-ups
      if (isFactBasedFollowup && allResults['research']) {
        const researchResult = allResults['research'];
        const researchCompleteness = this.evaluateResponseCompleteness(
          researchResult.output, 
          researchResult.confidence ?? 0,
          input,
          chatHistory
        );
        
        // If research agent has a reasonable response for a fact-based follow-up, use it
        if (researchCompleteness >= 0.6) {
          console.log(`Selected research agent for fact-based follow-up with completeness: ${researchCompleteness.toFixed(2)}`);
          return {
            agent: 'research',
            result: researchResult,
            all: allResults
          };
        }
      }
      
      // Select the agent with the highest completeness score
      let best = completenessScores[0];
      
      if (!best) {
        console.error('No agent returned a result');
        throw new Error('No agent returned a result');
      }
      
      // Apply adaptive thresholds based on agent type
      // These thresholds represent the minimum confidence needed for an agent to be considered
      // answering the user's question completely and accurately
      const agentThresholds: Record<string, number> = {
        'general': 0.6,   // General agent can handle many things with moderate confidence
        'weather': 0.4,   // Weather agent can be useful even with lower confidence
        'time': 0.4,      // Time agent can be useful even with lower confidence
        'current_time': 0.4, // Current time agent can be useful even with lower confidence
        'open_weather_map': 0.4, // Weather agent can be useful even with lower confidence
        'research': 0.6, // Lower threshold for research to make it more likely to be selected
        'document_search': 0.6, // Document search should be reasonably confident
        'summarizer': 0.85, // Summarizer should have very high confidence to be selected
        'code_interpreter': 0.75, // Code interpreter should have high confidence
        'code_optimization': 0.75, // Code optimization should have high confidence
      };
      
      // Get the appropriate threshold for the selected agent
      const adjustedThreshold = agentThresholds[best.name] ?? threshold;
      
      // Check if this is a short input based on character/word count
      const isShortInput = input.trim().length < 15 || input.trim().split(/\s+/).length < 5;
      
      // Evaluate if the input is likely a conversational turn rather than a complex query
      // This is more about the structure than specific patterns
      const isLikelyConversational = 
        isShortInput || // Short inputs are often conversational
        !input.includes('?') || // Non-questions are often conversational
        input.split(/[.!?]/).length <= 2; // Few sentences suggests conversational
      
      // Special handling for the summarizer agent
      if (best.name === 'summarizer') {
        // Check if another agent has a good enough completeness score
        const nextBest = completenessScores.find(c => c.name !== 'summarizer');
        if (nextBest && (best.completeness - nextBest.completeness) < 0.2) {
          console.log(`Choosing ${nextBest.name} over summarizer as the completeness difference is small: ${(best.completeness - nextBest.completeness).toFixed(2)}`);
          best = nextBest;
        }
      }
      
      // Special handling for research agent
      if (completenessScores.some(c => c.name === 'research')) {
        const researchScore = completenessScores.find(c => c.name === 'research')!;
        
        // If research agent is reasonably good, prefer it for factual queries
        if (researchScore.completeness >= 0.65 && isFactBasedFollowup) {
          console.log(`Selected research agent for factual query with completeness: ${researchScore.completeness.toFixed(2)}`);
          return {
            agent: 'research',
            result: researchScore.result,
            all: allResults
          };
        }
      }
      
      // Use the best agent by completeness
      return { 
        agent: best.name, 
        result: best.result, 
        all: allResults 
      };
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
  
  // Helper method to detect if a query is a fact-based follow-up
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
}
