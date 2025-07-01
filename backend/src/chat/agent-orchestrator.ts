// agent-orchestrator.ts
import { AgentRegistry, AgentHandler, AgentResult } from "./agent-registry";

export interface AgentStep {
  agent: string; // agent name
  input: (prevResult: string | undefined, context: any) => Promise<string> | string;
}

export class AgentOrchestrator {
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
      
      // Simple optimization for very short inputs (just a performance consideration, not linguistic)
      const isShortInput = input.trim().length < 15;
      
      // For very short inputs, we might want to directly test the general agent
      // This is purely a performance optimization to avoid calling many agents for simple inputs
      if (isShortInput && agentNames.includes('general')) {
        // Run only the general agent first to see if it can handle it confidently
        const generalAgent = AgentRegistry.getAgent('general');
        if (generalAgent) {
          const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry);
          const generalResult = await generalAgent.handle(input, context, boundCallAgent);
          
          // If general agent is very confident (>0.8), use it directly
          if ((generalResult.confidence ?? 0) > 0.8) {
            console.log(`General agent has high confidence (${generalResult.confidence}) for short input, using directly`);
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
      // These thresholds can be tuned based on observation without changing the logic
      const agentThresholds: Record<string, number> = {
        'general': 0.6,   // General agent can handle many things with moderate confidence
        'weather': 0.4,   // Weather agent can be useful even with lower confidence
        'time': 0.4,      // Time agent can be useful even with lower confidence
        'research': 0.65, // Research should be reasonably confident
        'document_search': 0.6, // Document search should be reasonably confident
        // Default threshold is used for any agent not listed
      };
      
      // Get the appropriate threshold for the selected agent
      const adjustedThreshold = agentThresholds[best.agent] ?? threshold;
      
      // Short inputs (like greetings) should require higher confidence from specialized agents
      // This prevents specialized agents from taking over basic conversations
      if (isShortInput && best.agent !== 'general') {
        // For short inputs, require higher confidence from specialized agents
        const shortInputThreshold = 0.8;
        
        console.log(`Short input detected - using higher threshold (${shortInputThreshold}) for specialized agent ${best.agent}`);
        
        if ((best.result.confidence ?? 0) < shortInputThreshold && allResults['general']) {
          console.log(`${best.agent} confidence (${best.result.confidence}) below short input threshold, using general agent`);
          best = { agent: 'general', result: allResults['general'] };
        }
      } 
      // Normal threshold check for standard inputs
      else if ((best.result.confidence ?? 0) < adjustedThreshold) {
        console.log(`Agent ${best.agent} confidence ${best.result.confidence ?? 0} below threshold ${adjustedThreshold}`);
        
        // If the most confident agent is still below threshold and general agent is available, use general agent
        if (best.agent !== 'general' && allResults['general']) {
          const generalConfidence = allResults['general'].confidence ?? 0;
          
          // Only use general if it has at least 80% of the confidence of the best agent
          if (generalConfidence >= (best.result.confidence ?? 0) * 0.8) {
            console.log(`${best.agent} below threshold, falling back to general agent with confidence ${generalConfidence}`);
            best = { agent: 'general', result: allResults['general'] };
          } else {
            // The general agent has much lower confidence, stick with original choice but warn
            console.log(`Keeping ${best.agent} despite below threshold as general agent has much lower confidence`);
          }
        } else {
          best.result.output = `I'm not confident in my answer. Can you clarify your request?`;
        }
      } else {
        console.log(`Agent ${best.agent} confidence ${best.result.confidence ?? 0} meets threshold ${adjustedThreshold}`);
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
