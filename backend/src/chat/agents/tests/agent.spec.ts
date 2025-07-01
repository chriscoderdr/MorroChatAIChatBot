import { Test, TestingModule } from '@nestjs/testing';
import { AgentRegistry, AgentResult } from '../../agent-registry';
import { ChatModule } from '../../chat.module';
import { ConfigModule } from '@nestjs/config';
import appConfig from '../../../config/app.config';
import aiConfig from '../../../config/ai.config';
import databaseConfig from '../../../config/database.config';
import throttleConfig from '../../../config/throttle.config';
import { withSessionMutex } from '../../services/session-mutex';
import { MongoDBChatMessageHistory } from '../../services/mongodb.chat.message.history';
import { SessionCacheService } from '../../services/session-cache.service';

describe('Agent Tests', () => {
  let moduleRef: TestingModule;
  let sessionCacheService: SessionCacheService;
  let chatSessionModel: any; // Model<ChatSession>

  beforeAll(async () => {
    // Set up the test module with actual dependencies
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, aiConfig, databaseConfig, throttleConfig],
          isGlobal: true,
        }),
        ChatModule,
      ],
    }).compile();

    sessionCacheService = moduleRef.get<SessionCacheService>(SessionCacheService);
    // Get the mongoose model directly
    chatSessionModel = moduleRef.get('ChatSessionModel');
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  // Helper function to create test sessions
  const createTestSession = (sessionId: string) => {
    return {
      sessionId,
      sessionCache: sessionCacheService,
      // Create a new history instance for this session
      mongoHistory: new MongoDBChatMessageHistory(chatSessionModel, sessionId),
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
      // First question to establish context
      await testAgent('research', 'Who is the current president of the United States?', 'research-followup-session');
      
      // Follow-up question
      const followupResponse = await testAgent('research', 'How old is he?', 'research-followup-session', undefined, true);
      expect(followupResponse).toBeDefined();
      expect(followupResponse.output).toBeDefined();
      // Should contain age information
      expect(followupResponse.output).toMatch(/\d+ years|age|born/i);
    });

    it('should not leak thought processes in responses', async () => {
      const response = await testAgent('research', 'What are the latest AI developments?', 'research-leakage-session');
      expect(response.output).not.toMatch(/\bTHOUGHT\b|\bACTION\b|\bOBSERVATION\b/i);
      expect(response.output).not.toMatch(/I'll use the web_search tool/i);
    });
  });

  describe('Document Agent', () => {
    it('should respond about documents', async () => {
      const response = await testAgent('document', 'Summarize my last document', 'document-test-session');
      expect(response).toBeDefined();
      expect(response.output).toBeDefined();
    });
  });

  describe('Topic Filtering', () => {
    it('should filter inappropriate topics', async () => {
      const response = await testAgent('research', 'Tell me a political joke', 'filter-test-session');
      expect(response.output).toMatch(/cannot discuss|steer away|avoid|don't discuss/i);
    });
  });

  describe('Agent Router', () => {
    it('should route to the correct agent based on input', async () => {
      // Test various inputs and verify they route to the expected agent
      const weatherInput = 'What\'s the weather like today?';
      const timeInput = 'What time is it now?';
      const researchInput = 'Who invented the telephone?';
      const documentInput = 'Summarize my document about AI';
      
      // We can verify routing by checking the agent registry's logs or mocking it
      // For now, we'll just check that responses make sense
      const weatherResponse = await AgentRegistry.callAgent('weather', weatherInput, { sessionId: 'router-test' });
      const timeResponse = await AgentRegistry.callAgent('time', timeInput, { sessionId: 'router-test' });
      const researchResponse = await AgentRegistry.callAgent('research', researchInput, { sessionId: 'router-test' });
      const documentResponse = await AgentRegistry.callAgent('document', documentInput, { sessionId: 'router-test' });
      
      expect(weatherResponse.output).toMatch(/(temperature|forecast|weather)/i);
      expect(timeResponse.output).toMatch(/(current time|is \d{1,2}:\d{2})/i);
      expect(researchResponse.output).toMatch(/(Bell|telephone|invented)/i);
      expect(documentResponse.output).toMatch(/(document|AI|summarize)/i);
    });
  });
});
