import { Injectable } from '@nestjs/common';
import { AIMessage } from '@langchain/core/messages';

// A simplified mock for LlmService to be used in tests
@Injectable()
export class LlmServiceMock {
  private llms = new Map<string, any>();

  // Pre-configure a mock LLM for a specific agent
  setLlm(agentName: string, llm: any) {
    this.llms.set(agentName, llm);
  }

  // The main method that gets replaced in tests
  getLlm(agentName?: string): any {
    if (agentName && this.llms.has(agentName)) {
      return this.llms.get(agentName);
    }
    // Fallback mock
    return {
      invoke: jest.fn().mockResolvedValue(
        new AIMessage({
          content: JSON.stringify({
            agent: 'general',
            confidence: 0.9,
          }),
        }),
      ),
    };
  }

  // Utility to clear all mocks between tests
  clearLlms() {
    this.llms.clear();
  }
}
