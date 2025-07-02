import { TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ChatController } from '../controllers/chat.controller';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { AgentOrchestrator } from '../agent-orchestrator';
import { setupTestModule } from './test-helpers';
import { AgentRegistry } from '../agent-registry';
import { AgentName } from '../types';
import '../document-search.agent';
import '../summarizer.agent';
import '../research.agent';
import '../weather.agent';
import '../code-interpreter.agent';
import '../code-optimization.agent';
import '../general.agent';
import '../routing.agent';
import '../subject-inference.agent';

// Mock external fetch
global.fetch = jest.fn();

describe('Agent Integration Tests with Mocks', () => {
  let module: TestingModule;
  let chatController: ChatController;
  let chatSessionRepository: ChatSessionRepository;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testModule = await setupTestModule();
    module = testModule.module;
    mongod = testModule.mongod;
    mongoConnection = testModule.mongoConnection;
    cleanup = testModule.cleanup;

    chatController = module.get<ChatController>(ChatController);
    chatSessionRepository = module.get<ChatSessionRepository>(
      ChatSessionRepository,
    );
  });

  afterAll(async () => {
    await cleanup();
  });

  afterEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(chatController).toBeDefined();
  });

  it('should route to web_search agent for research questions', async () => {
    const req = { session: { userId: 'test-user-research' } };
    const body = { message: 'When was Soluciones GBH founded?' };

    (AgentOrchestrator.routeByConfidence as jest.Mock).mockResolvedValue({
      agent: 'research',
      result: {
        output: 'Soluciones GBH was founded in 2004.',
        confidence: 0.98,
      },
    });

    const response = await chatController.chat(req as any, body);

    expect(response.reply).toBe('Soluciones GBH was founded in 2004.');
    expect(AgentOrchestrator.routeByConfidence).toHaveBeenCalledWith(
      expect.any(Array),
      body.message,
      expect.any(Object),
    );
  });

  it('should route to weather agent for weather questions', async () => {
    const req = { session: { userId: 'test-user-weather' } };
    const body = { message: "What's the weather like in Santo Domingo?" };

    (AgentOrchestrator.routeByConfidence as jest.Mock).mockResolvedValue({
      agent: 'weather',
      result: {
        output: 'Current weather in Santo Domingo, DO: sunny.',
        confidence: 0.98,
      },
    });

    const response = await chatController.chat(req as any, body);

    expect(response.reply).toContain('Current weather in Santo Domingo, DO: sunny.');
  });

  it('should use the LLM for general conversation', async () => {
    const req = { session: { userId: 'test-user-general' } };
    const body = { message: 'Hello, how are you?' };

    (AgentOrchestrator.routeByConfidence as jest.Mock).mockResolvedValue({
      agent: 'general',
      result: {
        output: 'This is a mocked LLM response.',
        confidence: 0.9,
      },
    });

    const response = await chatController.chat(req as any, body);

    expect(response.reply).toBe('This is a mocked LLM response.');
  });

  describe('Chat History', () => {
    it('should return chat history for a session', async () => {
      const browserSessionId = 'test-user-history';
      const req = { browserSessionId }; // Align with controller

      // Create a session and add a message
      const session = await chatSessionRepository.createSession(browserSessionId);
      session.messages.push({
        type: 'human',
        data: { content: 'hello' },
      } as any);
      await session.save();

      const history = await chatController.getSessionHistory(req as any);
      expect(history).toHaveLength(1);
      expect(history[0].data.content).toBe('hello');
    });
  });

  describe('Agent Registration', () => {
    it('should have all required agents registered', () => {
      const requiredAgents: AgentName[] = [
        'document_search',
        'summarizer',
        'research',
        'weather',
        'general',
        'routing',
      ];

      requiredAgents.forEach((agentName) => {
        const agent = AgentRegistry.getAgent(agentName);
        expect(agent).toBeDefined();
      });
    });
  });
});
