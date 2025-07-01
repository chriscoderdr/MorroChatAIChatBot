// agent-orchestrator-new.ts
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
  private static evaluateResponseCompleteness(response: string | any, confidence: number): number {
    let completenessScore = 0;
    
    // Ensure response is a string
    const responseStr = typeof response === 'string' ? response : 
                       (response && typeof response.output === 'string') ? response.output : 
                       (response && typeof response.toString === 'function') ? response.toString() : '';
    
    // Base score from confidence
    completenessScore += confidence * 0.6; // Up to 0.6 points from confidence
    
    // Length-based scoring
    if (responseStr.length >= 10 && responseStr.length < 300) completenessScore += 0.2;
    else if (responseStr.length >= 300 && responseStr.length < 1000) completenessScore += 0.1;
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
    
    // Check for special conversational indicators
    if ((responseStr.includes("¡Hola") || responseStr.includes("Hello") || 
         responseStr.includes("Hi there") || responseStr.includes("Greetings")) && 
        responseStr.length < 100) {
      // Greeting responses should get a bonus for simple greeting inputs
      completenessScore += 0.15;
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

  // The new LLM-based confidence routing method
  async routeByConfidence(
    session: string,
    input: string,
    specializedAgents: Array<[string, number, string]>,
    generalAgent: [string, number, string],
    summarizerAgent: [string, number, string],
    isLikelyConversational?: boolean
  ): Promise<[string, number, string]> {
    this.logger.log(
      `Routing by confidence: specialized=${specializedAgents.map(a => `${a[0]}:${a[1]}`).join(',')} general=${generalAgent[0]}:${generalAgent[1]} summarizer=${summarizerAgent[0]}:${summarizerAgent[1]}`
    );

    // Sort all agents by confidence to see what we're working with
    const allAgents = [...specializedAgents, generalAgent];
    const sortedByConfidence = [...allAgents].sort((a, b) => b[1] - a[1]);
    
    // Calculate completeness scores for all agents including general agent
    const completenessScores = [...allAgents, summarizerAgent].map(([name, confidence, response]) => {
      const completeness = AgentOrchestrator.evaluateResponseCompleteness(response, confidence);
      return { name, confidence, response, completeness };
    });
    
    // Sort by completeness score
    completenessScores.sort((a, b) => b.completeness - a.completeness);
    
    this.logger.log(
      `Completeness scores: ${completenessScores.map(c => `${c.name}:${c.confidence.toFixed(2)}:${c.completeness.toFixed(2)}`).join(', ')}`
    );
    
    // Check if we have a high-confidence specialized agent response (to avoid unnecessary summarization)
    const highConfidenceThreshold = 0.85;
    const highCompletenessThreshold = 0.8;
    
    // If the top agent has high confidence and completeness, use it directly
    const topAgent = completenessScores[0];
    if (topAgent.confidence >= highConfidenceThreshold && topAgent.completeness >= highCompletenessThreshold) {
      this.logger.log(`Selected ${topAgent.name} based on high confidence (${topAgent.confidence.toFixed(2)}) and completeness (${topAgent.completeness.toFixed(2)})`);
      return [topAgent.name, topAgent.confidence, topAgent.response];
    }
    
    // For short inputs, favor the general agent if it has reasonable completeness
    const isShortInput = input.split(' ').length <= 5;
    const generalIndex = completenessScores.findIndex(a => a.name === generalAgent[0]);
    
    if (isShortInput && generalIndex >= 0 && completenessScores[generalIndex].completeness > 0.7) {
      this.logger.log(`Selected general agent for short input with good completeness: ${completenessScores[generalIndex].completeness.toFixed(2)}`);
      return [generalAgent[0], generalAgent[1], generalAgent[2]];
    }
    
    // For specialized queries where research has good results, prefer it over the summarizer
    const researchAgentIndex = completenessScores.findIndex(a => a.name === 'research');
    if (researchAgentIndex >= 0 && completenessScores[researchAgentIndex].completeness > 0.75) {
      const researchAgent = completenessScores[researchAgentIndex];
      this.logger.log(`Selected research agent with good completeness: ${researchAgent.completeness.toFixed(2)}`);
      return [researchAgent.name, researchAgent.confidence, researchAgent.response];
    }
    
    // Only use summarizer if it has notably better completeness than the top agent
    const summarizerIndex = completenessScores.findIndex(a => a.name === summarizerAgent[0]);
    if (summarizerIndex > 0 && // Not already the top agent
        (completenessScores[summarizerIndex].completeness - completenessScores[0].completeness) < 0.15) {
      // If summarizer isn't significantly better, use the top non-summarizer agent
      const topNonSummarizer = completenessScores.find(a => a.name !== summarizerAgent[0]);
      if (topNonSummarizer) {
        this.logger.log(`Selecting ${topNonSummarizer.name} over summarizer as summarizer completeness advantage is small`);
        return [topNonSummarizer.name, topNonSummarizer.confidence, topNonSummarizer.response];
      }
    }
    
    // Default to the highest completeness score
    return [topAgent.name, topAgent.confidence, topAgent.response];
  }

  // The original confidence-based routing method - maintained for compatibility
  static async routeByConfidence(agentNames: string[], input: string, context: any = {}, threshold = 0.7): Promise<{ agent: string, result: AgentResult, all: { [agent: string]: AgentResult } }> {
    try {
      console.log(`Starting confidence-based routing for input: "${input.substring(0, 30)}${input.length > 30 ? '...' : ''}"`);
      console.log(`Considering ${agentNames.length} agents: ${agentNames.join(', ')}`);
      
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

      // Calculate completeness scores for all agents
      const completenessScores = Object.entries(allResults).map(([name, result]) => {
        const completeness = this.evaluateResponseCompleteness(result.output, result.confidence ?? 0);
        return { name, result, completeness };
      });
      
      // Sort by completeness score
      completenessScores.sort((a, b) => b.completeness - a.completeness);
      
      console.log(`Response completeness scores: ${completenessScores.map(c => 
        `${c.name}:${c.result.confidence?.toFixed(2) ?? 'n/a'}:${c.completeness.toFixed(2)}`).join(', ')}`);
      
      // If the top agent by completeness isn't the summarizer (assuming it exists), 
      // and it has a good completeness score, use it over the confidence-based selection
      const summarizerAgent = completenessScores.find(c => c.name === 'summarizer');
      const topCompleteness = completenessScores[0];
      
      // Only override the confidence-based selection with completeness-based selection
      // if the completeness is significantly better
      if (topCompleteness && 
          topCompleteness.completeness > 0.75 && 
          (topCompleteness.name !== 'summarizer' || topCompleteness.completeness > 0.9)) {
        console.log(`Selected ${topCompleteness.name} based on completeness score ${topCompleteness.completeness.toFixed(2)}`);
        return { 
          agent: topCompleteness.name, 
          result: topCompleteness.result, 
          all: allResults 
        };
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
