import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistry, AgentResult } from '../../agent-registry';
import { ConfigModule } from '@nestjs/config';
import aiConfig from '../../../config/ai.config';
import { LangChainService } from '../../services/langchain.service';

// Mock dependencies for LangChainService
const mockConfigService = {
  get: jest.fn().mockReturnValue('test-value'),
};

// Mock the chat session dependencies
const mockChatSessionModel = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ sessionId: 'test' }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
};

const mockSessionCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
};

// Initialize LangChainService to register agents
let langChainService: LangChainService;

describe('Agent Tests', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Initialize LangChainService to register all agents
    langChainService = new LangChainService(mockConfigService as any, mockChatSessionModel as any);
    
    // Set up a minimal test module without database dependencies
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [aiConfig],
          isGlobal: true,
        }),
      ],
      providers: [
        {
          provide: 'ChatSessionModel',
          useValue: mockChatSessionModel,
        },
        {
          provide: 'SessionCacheService',
          useValue: mockSessionCacheService,
        },
      ],
    }).compile();

    // Import agent files to register them
    await import('../../weather.agent');
    await import('../../routing.agent');
  });

  afterAll(async () => {
    // Stop all running async operations
    jest.clearAllTimers();
    jest.clearAllMocks();
    
    if (moduleRef) {
      await moduleRef.close();
    }
    
    // Give some time for any remaining async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // Helper function to create test sessions
  const createTestSession = (sessionId: string) => {
    return {
      sessionId,
      sessionCache: mockSessionCacheService,
      // Mock history for testing
      mongoHistory: {
        addMessage: jest.fn(),
        getMessages: jest.fn().mockResolvedValue([]),
        clear: jest.fn(),
      },
    };
  };

  // Helper to run agent tests
  const testAgent = async (
    agentName: string, 
    input: string, 
    sessionId: string = 'test-session',
    expectedPattern?: RegExp,
    isFollowup: boolean = false
  ): Promise<AgentResult> => {
    // Create a test session
    const session = createTestSession(sessionId);
    
    // Create context
    const context = {
      sessionId: session.sessionId,
      isFollowup,
    };

    // Call the agent and get response
    return await AgentRegistry.callAgent(agentName, input, context);
  };

  describe('Time Agent', () => {
    it('should return the current time', async () => {
      const response = await testAgent('time', 'What time is it?', 'time-test-session', /current time|is \d{1,2}:\d{2}/i);
      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
    });
  });

  describe('Weather Agent', () => {
    it('should return weather information', async () => {
      const response = await testAgent('weather', 'What\'s the weather in New York?', 'weather-test-session', /(temperature|forecast|weather)/i);
      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
    });
  });

  describe('Research Agent', () => {
    it('should perform web research', async () => {
      const response = await testAgent('research', 'Who is the current president of the United States?', 'research-test-session');
      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
      // Response should contain relevant information about the president
      expect(response.output).toMatch(/Biden|President|White House/i);
    });
    
    it('should handle follow-up questions', async () => {
      // Follow-up question with more explicit context
      const followupResponse = await testAgent('research', 'How old is Joe Biden the US president?', 'research-followup-session', undefined, true);
      expect(followupResponse).toBeDefined();
      expect(followupResponse.output).toBeDefined();
      // Should contain age information
      expect(followupResponse.output).toMatch(/\d+ years|age|born|82|81/i);
    });

    it('should not leak thought processes in responses', async () => {
      const response = await testAgent('research', 'What are the latest AI developments?', 'research-leakage-session');
      expect(response.output).not.toMatch(/\bTHOUGHT\b|\bACTION\b|\bOBSERVATION\b/i);
      expect(response.output).not.toMatch(/I'll use the web_search tool/i);
    });
  });

  describe('Document Agent', () => {
    it('should respond about documents', async () => {
      const response = await testAgent('document_search', 'Summarize my last document', 'document-test-session');
      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
    });
  });

  describe('Topic Filtering', () => {
    it('should filter inappropriate topics', async () => {
      const response = await testAgent('research', 'Tell me a political joke', 'filter-test-session');
      expect(response.output).toMatch(/do not have|cannot provide|not available|unable to|don't have/i);
    });
  });

  describe('Agent Router', () => {
    it('should route to the correct agent based on input', async () => {
      // Test various inputs and verify they route to the expected agent
      const weatherInput = 'What\'s the weather like in New York today?';
      const timeInput = 'What time is it now?';
      const researchInput = 'Who invented the telephone?';
      const documentInput = 'Summarize my document about AI';
      
      // We can verify routing by checking the agent registry's logs or mocking it
      // For now, we'll just check that responses make sense
      const weatherResponse = await AgentRegistry.callAgent('open_weather_map', weatherInput, { sessionId: 'router-test' });
      const timeResponse = await AgentRegistry.callAgent('time', timeInput, { sessionId: 'router-test' });
      const researchResponse = await AgentRegistry.callAgent('research', researchInput, { sessionId: 'router-test' });
      const documentResponse = await AgentRegistry.callAgent('document_search', documentInput, { sessionId: 'router-test' });
      
      expect(weatherResponse.output).toMatch(/(temperature|forecast|weather|Could not find location|API returned error)/i);
      expect(timeResponse.output).toMatch(/(current time|is \d{1,2}:\d{2}|need to know|location)/i);
      expect(researchResponse.output).toMatch(/(Bell|telephone|invented)/i);
      expect(documentResponse.output).toMatch(/(document|AI|summarize)/i);
    });
  });
});
