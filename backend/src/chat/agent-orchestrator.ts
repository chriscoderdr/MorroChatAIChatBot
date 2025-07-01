// agent-orchestrator.ts
import { AgentRegistry, AgentHandler, AgentResult } from "./agent-registry";

export interface AgentStep {
  agent: string; // agent name
  input: (prevResult: string | undefined, context: any) => Promise<string> | string;
}

export class AgentOrchestrator {
  // Evaluate response completeness based on content rather than just confidence
  // This applies objective criteria that works across different agent types
  private static evaluateResponseCompleteness(response: string, confidence: number): number {
    let completenessScore = 0;
    
    // Base score from confidence
    completenessScore += confidence * 0.6; // Up to 0.6 points from confidence
    
    // Length-based scoring
    if (response.length >= 10 && response.length < 300) completenessScore += 0.2;
    else if (response.length >= 300 && response.length < 1000) completenessScore += 0.1;
    else if (response.length < 10) completenessScore -= 0.3;
    else if (response.length > 1000) completenessScore -= 0.1; // Penalize very verbose answers
    
    // Content-based scoring - check for markers of incomplete answers
    if (response.includes("I need to search") || 
        response.includes("I don't have enough information") ||
        response.includes("I need more information") ||
        response.includes("could you clarify") ||
        response.includes("I'd need to search")) {
      completenessScore -= 0.4;
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
          const responseSeemsSufficient =
            generalResult.output.length >= 10 && // Not too short
            generalResult.output.length < 300 && // Not too verbose
            !generalResult.output.includes("I need to search") && // Not indicating more info needed
            !generalResult.output.includes("I don't have enough information"); // Not indicating incomplete
          
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
      
      // Run all agents in parallel and collect their results
      const allResults = await this.runParallel(agentNames, input, context);
      
      // Log confidence scores for debugging
      console.log(`AgentOrchestrator confidence scores:`, 
        Object.entries(allResults).map(([name, result]) => 
          `${name}: ${result.confidence ?? 'undefined'}`));
      
      // Select the agent with the highest confidence
      let best: { agent: string, result: AgentResult } | undefined = undefined;
      
      for (const [agent, result] of Object.entries(allResults)) {
        if (!best || (result.confidence ?? 0) > (best.result.confidence ?? 0)) {
          best = { agent, result };
        }
      }
      
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
        'research': 0.65, // Research should be reasonably confident
        'document_search': 0.6, // Document search should be reasonably confident
        'summarizer': 0.0, // Summarizer should have very high confidence to be selected
        'code_interpreter': 0.75, // Code interpreter should have high confidence
        'code_optimization': 0.75, // Code optimization should have high confidence
        // Default threshold is used for any agent not listed
      };
      
      // Get the appropriate threshold for the selected agent
      const adjustedThreshold = agentThresholds[best.agent] ?? threshold;
      
      // Use more reliable indicators for conversational inputs instead of pattern matching
      // These are structural and linguistic characteristics that can help identify conversational inputs
      
      // Check if this is a short input based on character/word count
      const isShortInput = input.trim().length < 15 || input.trim().split(/\s+/).length < 5;
      
      // Evaluate if the input is likely a conversational turn rather than a complex query
      // This is more about the structure than specific patterns
      const isLikelyConversational = 
        isShortInput || // Short inputs are often conversational
        !input.includes('?') || // Non-questions are often conversational
        input.split(/[.!?]/).length <= 2; // Few sentences suggests conversational
      
      // Use this as our conversational input detector - simpler and more reliable
      const isConversationalInput = isLikelyConversational;
      
      // Check if general agent already has a valid and complete response for conversational inputs
      // This prevents us from running specialized agents for simple greetings
      if (isConversationalInput && allResults['general']) {
        const generalResult = allResults['general'];
        const generalConfidence = generalResult.confidence ?? 0;
        
        // For greetings and introductions, if general agent has a good response, use it directly
        // A good response is one that's both reasonably confident and looks like a proper greeting
        const generalHasCompleteResponse = 
          // Check confidence is reasonably high
          generalConfidence >= 0.7 && 
          // Check if response length looks like a reasonable greeting (not too short, not too long)
          generalResult.output.length >= 10 && 
          generalResult.output.length < 200;
          
        // If general has a complete response for what's likely a greeting or intro, use it directly
        if (generalHasCompleteResponse) {
          console.log(`General agent has a complete response (${generalConfidence}) for conversational input, using directly`);
          best = { agent: 'general', result: generalResult };
          // Skip further threshold checks since we've determined this is a simple conversational input
          return { ...best, all: allResults };
        }
        
        // For conversational inputs, still raise the threshold for specialized agents
        if (best.agent !== 'general') {
          const conversationalThreshold = 0.9;
          console.log(`Conversational input detected - using higher threshold (${conversationalThreshold}) for specialized agent ${best.agent}`);
          
          // If specialized agent's confidence isn't extremely high, prefer the general agent
          if ((best.result.confidence ?? 0) < conversationalThreshold) {
            if (generalConfidence >= 0.7) {
              console.log(`Preferring general agent (${generalConfidence}) over ${best.agent} (${best.result.confidence}) for conversational input`);
              best = { agent: 'general', result: generalResult };
              // Skip further threshold checks since we've manually selected the general agent
              return { ...best, all: allResults };
            }
          }
        }
      }
      
      // Short inputs should require higher confidence from specialized agents
      // This prevents specialized agents from taking over basic conversations
      if ((isShortInput || isConversationalInput) && best.agent !== 'general') {
        // For short/conversational inputs, require higher confidence from specialized agents
        const shortInputThreshold = isConversationalInput ? 0.9 : 0.8;
        
        console.log(`${isShortInput ? 'Short' : 'Conversational'} input detected - using higher threshold (${shortInputThreshold}) for specialized agent ${best.agent}`);
        
        if ((best.result.confidence ?? 0) < shortInputThreshold && allResults['general']) {
          const generalConfidence = allResults['general'].confidence ?? 0;
          // Only use general agent if it has at least some reasonable confidence (0.65+)
          if (generalConfidence >= 0.65) {
            console.log(`${best.agent} confidence (${best.result.confidence}) below ${isShortInput ? 'short' : 'conversational'} input threshold, using general agent with confidence ${generalConfidence}`);
            best = { agent: 'general', result: allResults['general'] };
          } else {
            console.log(`Keeping ${best.agent} despite below threshold as general agent has low confidence (${generalConfidence})`);
          }
        }
      } 
      // Normal threshold check for standard inputs - check if the answer is complete
      else if ((best.result.confidence ?? 0) < adjustedThreshold) {
        console.log(`Agent ${best.agent} confidence ${best.result.confidence ?? 0} below threshold ${adjustedThreshold} - checking response completeness`);
        
        // If the most confident agent is still below threshold and general agent is available, check response quality
        if (best.agent !== 'general' && allResults['general']) {
          const generalConfidence = allResults['general'].confidence ?? 0;
          const bestConfidence = best.result.confidence ?? 0;
          
          // Use our response completeness evaluator to make a better decision
          const bestCompletenessScore = AgentOrchestrator.evaluateResponseCompleteness(best.result.output, bestConfidence);
          const generalCompletenessScore = AgentOrchestrator.evaluateResponseCompleteness(allResults['general'].output, generalConfidence);
          
          console.log(`Response completeness scores - ${best.agent}: ${bestCompletenessScore.toFixed(2)}, general: ${generalCompletenessScore.toFixed(2)}`);
          
          // For inputs where the general agent has a reasonable completeness score, prefer it
          // when specialized agents are below threshold
          if (generalCompletenessScore >= 0.7 && 
              (bestCompletenessScore < 0.75 || generalCompletenessScore >= bestCompletenessScore * 0.95)) {
            console.log(`${best.agent} below threshold, using general agent with completeness score ${generalCompletenessScore.toFixed(2)}`);
            best = { agent: 'general', result: allResults['general'] };
          } else {
            // The general agent has a less complete response, stick with original choice but warn
            console.log(`Keeping ${best.agent} despite below threshold as general agent has lower completeness score (${generalCompletenessScore.toFixed(2)} vs ${bestCompletenessScore.toFixed(2)})`);
          }
        } else if (best.agent === 'general' && (best.result.confidence ?? 0) < 0.4) {
          // If even the general agent has very low confidence, add a clarification request
          best.result.output = `I'm not confident I fully understand your request. Could you provide more details or rephrase your question?`;
        }
      } else {
        console.log(`Agent ${best.agent} confidence ${best.result.confidence ?? 0} meets threshold ${adjustedThreshold}`);
        
        // We'll use the evaluateResponseCompleteness method we defined above
        
        // Even for responses above threshold, check if this is likely conversational and general has good confidence
        // This ensures chit-chat goes to general agent even when specialized agents are confident
        if (best.agent !== 'general' && isConversationalInput && allResults['general']) {
          const generalConfidence = allResults['general'].confidence ?? 0;
          const bestConfidence = best.result.confidence ?? 0;
          
          // Calculate completeness scores
          const bestCompletenessScore = AgentOrchestrator.evaluateResponseCompleteness(best.result.output, bestConfidence);
          const generalCompletenessScore = AgentOrchestrator.evaluateResponseCompleteness(allResults['general'].output, generalConfidence);
          
          // For conversational inputs, general agent should win unless specialized agent is clearly better
          if (generalCompletenessScore >= 0.75 && 
              (bestCompletenessScore < 0.85 || generalCompletenessScore >= bestCompletenessScore * 0.9)) {
            console.log(`Preferring general agent (${generalConfidence}, completeness=${generalCompletenessScore.toFixed(2)}) over ${best.agent} (${bestConfidence}, completeness=${bestCompletenessScore.toFixed(2)}) for conversational input`);
            best = { agent: 'general', result: allResults['general'] };
          }
        }
      }
      
      return { ...best, all: allResults };
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
}
