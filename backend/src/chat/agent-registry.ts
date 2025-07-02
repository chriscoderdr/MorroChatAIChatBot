import { AgentResult, Agent, AgentName, AgentContext } from './types';

export class AgentRegistry {
  private static agents: Map<AgentName, Agent> = new Map();

  static register(agent: Agent) {
    this.agents.set(agent.name, agent);
  }

  static getAgent(name: AgentName): Agent | undefined {
    return this.agents.get(name);
  }

  static getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Utility for agent chaining: call another agent by name
  static async callAgent(
    name: AgentName,
    input: string,
    context: AgentContext,
  ): Promise<AgentResult> {
    // Ensure "this" is properly bound by creating a bound version of callAgent
    const boundCallAgent = AgentRegistry.callAgent.bind(AgentRegistry) as (
      name: AgentName,
      input: string,
      context: AgentContext,
    ) => Promise<AgentResult>;

    // Log for debugging
    console.log(
      `AgentRegistry.callAgent called for agent '${name}' with input: ${input.substring(
        0,
        50,
      )}...`,
    );

    const agent = AgentRegistry.getAgent(name);
    if (!agent) {
      console.error(
        `Agent '${name}' not found in registry. Available agents: ${Array.from(
          AgentRegistry.agents.keys(),
        ).join(', ')}`,
      );
      throw new Error(`Agent '${name}' not found`);
    }

    // Enhance context with non-linguistic metadata about the request
    const enhancedContext: AgentContext = {
      ...context,
      // Include basic metadata that doesn't assume any specific language
      inputLength: input.length,
      timestamp: new Date().toISOString(),
      agentName: name,
    };

    // Pass the explicitly bound callAgent for chaining
    return await agent.handle(input, enhancedContext, boundCallAgent);
  }
}
