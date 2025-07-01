import { AgentRegistry } from '../agent-registry';
import { LangChainService } from '../services/langchain.service';
import { ConfigService } from '@nestjs/config';

// Mock dependencies for LangChainService
const mockConfigService = {
  get: jest.fn().mockReturnValue('test-value'),
};

const mockChatSessionModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};

// Initialize LangChainService to register agents
beforeAll(() => {
  // This will call the constructor and register the agents
  new LangChainService(mockConfigService as any, mockChatSessionModel as any);
});

describe('Weather Agent Tests', () => {
  it('should handle weather queries correctly', async () => {
    const result = await AgentRegistry.callAgent('open_weather_map', 'What\'s the weather like in New York?', {});
    expect(result).toBeDefined();
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('string');
    // Should contain weather-related terms
    expect(result.output.toLowerCase()).toMatch(/weather|temperature|new york/i);
  });

  it('should extract location from query', async () => {
    const result = await AgentRegistry.callAgent('open_weather_map', 'Tell me about the weather in Los Angeles', {});
    expect(result.output.toLowerCase()).toMatch(/los angeles/i);
  });

  it('should handle follow-up questions with context', async () => {
    // First set the context with New York
    await AgentRegistry.callAgent('open_weather_map', 'What\'s the weather like in New York?', {
      sessionId: 'weather-test-session'
    });
    
    // Then ask a follow-up that doesn't specify location
    const result = await AgentRegistry.callAgent('open_weather_map', 'How about tomorrow?', {
      sessionId: 'weather-test-session',
      isFollowup: true
    });
    
    // It should still relate to New York
    expect(result.output).toBeDefined();
    // Either it maintains context or asks for clarification
    expect(result.output.toLowerCase()).toMatch(/new york|location|specify/i);
  });
});
