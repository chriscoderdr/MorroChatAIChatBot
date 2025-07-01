// agent-registry.ts
// A simple pluggable agent registry for dynamic agent/skill registration

export interface AgentResult {
  output: string;
  confidence?: number; // 0.0 - 1.0
}

export interface AgentHandler {
  name: string;
  description: string;
  // handle can now receive a 'callAgent' function for chaining
  handle: (input: string, context: any, callAgent: (name: string, input: string, context?: any) => Promise<AgentResult>) => Promise<AgentResult>;
}

export class AgentRegistry {
  private static agents: Map<string, AgentHandler> = new Map();

  static register(agent: AgentHandler) {
    this.agents.set(agent.name, agent);
  }

  static getAgent(name: string): AgentHandler | undefined {
    return this.agents.get(name);
  }

  static getAllAgents(): AgentHandler[] {
    return Array.from(this.agents.values());
  }

  // Utility for agent chaining: call another agent by name
  static async callAgent(name: string, input: string, context: any = {}): Promise<AgentResult> {
    const agent = this.getAgent(name);
    if (!agent) throw new Error(`Agent '${name}' not found`);
    // Pass callAgent recursively for chaining
    return agent.handle(input, context, this.callAgent.bind(this));
  }
}
