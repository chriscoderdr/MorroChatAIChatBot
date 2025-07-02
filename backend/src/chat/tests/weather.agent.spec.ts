import { AgentRegistry } from '../agent-registry';
import { LangChainService } from '../services/langchain.service';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { ChatSession } from '../schemas/chat-session.schema';
import { AgentContext } from '../types';

// Mock dependencies for LangChainService
const mockConfigService: Partial<ConfigService> = {
  get: jest.fn().mockReturnValue('test-value'),
};

const mockChatSessionModel: Partial<Model<ChatSession>> = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};

// Initialize LangChainService to register agents
beforeAll(() => {
  // This will call the constructor and register the agents
  new LangChainService(
    mockConfigService as ConfigService,
    mockChatSessionModel as Model<ChatSession>,
  );
});

describe('Weather Agent Tests', () => {
  it('should handle weather queries correctly', async () => {
    const mockContext: AgentContext = {
      sessionId: 'test-session',
      chatHistory: [],
      input: "What's the weather like in New York?",
    };
    const result = await AgentRegistry.callAgent(
      'open_weather_map',
      "What's the weather like in New York?",
      mockContext,
    );
    expect(result).toBeDefined();
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('string');
    // Should contain weather-related terms
    expect(result.output.toLowerCase()).toMatch(
      /weather|temperature|new york/i,
    );
  });

  it('should extract location from query', async () => {
    const mockContext: AgentContext = {
      sessionId: 'test-session',
      chatHistory: [],
      input: 'Tell me about the weather in Los Angeles',
    };
    const result = await AgentRegistry.callAgent(
      'open_weather_map',
      'Tell me about the weather in Los Angeles',
      mockContext,
    );
    expect(result.output.toLowerCase()).toMatch(/los angeles/i);
  });

  it('should handle follow-up questions with context', async () => {
    const mockContext1: AgentContext = {
      sessionId: 'weather-test-session',
      chatHistory: [],
      input: "What's the weather like in New York?",
    };
    // First set the context with New York
    await AgentRegistry.callAgent(
      'open_weather_map',
      "What's the weather like in New York?",
      mockContext1,
    );

    const mockContext2: AgentContext = {
      sessionId: 'weather-test-session',
      chatHistory: [],
      input: 'How about tomorrow?',
      isFollowup: true,
    };
    // Then ask a follow-up that doesn't specify location
    const result = await AgentRegistry.callAgent(
      'open_weather_map',
      'How about tomorrow?',
      mockContext2,
    );

    // It should still relate to New York
    expect(result.output).toBeDefined();
    // Either it maintains context or asks for clarification
    expect(result.output.toLowerCase()).toMatch(/new york|location|specify/i);
  });
});
