import { AgentRegistry } from '../agent-registry';

describe('Weather Agent Tests', () => {
  it('should handle weather queries correctly', async () => {
    const result = await AgentRegistry.callAgent('weather', 'What\'s the weather like in New York?', {});
    expect(result).toBeDefined();
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('string');
    // Should contain weather-related terms
    expect(result.output.toLowerCase()).toMatch(/weather|temperature|new york/i);
  });

  it('should extract location from query', async () => {
    const result = await AgentRegistry.callAgent('weather', 'Tell me about the weather in Los Angeles', {});
    expect(result.output.toLowerCase()).toMatch(/los angeles/i);
  });

  it('should handle follow-up questions with context', async () => {
    // First set the context with New York
    await AgentRegistry.callAgent('weather', 'What\'s the weather like in New York?', {
      sessionId: 'weather-test-session'
    });
    
    // Then ask a follow-up that doesn't specify location
    const result = await AgentRegistry.callAgent('weather', 'How about tomorrow?', {
      sessionId: 'weather-test-session',
      isFollowup: true
    });
    
    // It should still relate to New York
    expect(result.output).toBeDefined();
    // Either it maintains context or asks for clarification
    expect(result.output.toLowerCase()).toMatch(/new york|location|specify/i);
  });
});
