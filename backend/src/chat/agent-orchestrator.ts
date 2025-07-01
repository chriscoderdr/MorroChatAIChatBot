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
    for (const step of steps) {
      const agentHandler = AgentRegistry.getAgent(step.agent);
      if (!agentHandler) throw new Error(`Agent '${step.agent}' not found`);
      const input = await step.input(prevResult, context);
      const result = await agentHandler.handle(input, context, AgentRegistry.callAgent);
      results.push(result);
      prevResult = result.output;
    }
    return { results };
  }

  // Example: run agents in parallel (returns all results)
  static async runParallel(agentNames: string[], input: string, context: any = {}): Promise<{ [agent: string]: AgentResult }> {
    const promises = agentNames.map(async (name) => {
      const agentHandler = AgentRegistry.getAgent(name);
      if (!agentHandler) throw new Error(`Agent '${name}' not found`);
      return [name, await agentHandler.handle(input, context, AgentRegistry.callAgent)] as [string, AgentResult];
    });
    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  }

  // Confidence-based routing: run all, pick best, or ask for clarification
  static async routeByConfidence(agentNames: string[], input: string, context: any = {}, threshold = 0.7): Promise<{ agent: string, result: AgentResult, all: { [agent: string]: AgentResult } }> {
    const allResults = await this.runParallel(agentNames, input, context);
    let best: { agent: string, result: AgentResult } | undefined = undefined;
    for (const [agent, result] of Object.entries(allResults)) {
      if (!best || (result.confidence ?? 0) > (best.result.confidence ?? 0)) {
        best = { agent, result };
      }
    }
    if (!best) throw new Error('No agent returned a result');
    if ((best.result.confidence ?? 0) < threshold) {
      best.result.output = `I'm not confident in my answer. Can you clarify your request?`;
    }
    return { ...best, all: allResults };
  }
}
