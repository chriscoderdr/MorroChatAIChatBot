import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model } from 'mongoose';
import { LlmService } from '../../llm/llm.service';
import { ChromaService } from '../services/chroma.service';
import { ChatSession, ChatSessionSchema } from '../schemas/chat-session.schema';
import { ChatController } from '../controllers/chat.controller';
import { ChatService } from '../services/chat.service';
import { ChatSessionRepository } from '../repositories/chat-session.repository';
import { SessionCacheService } from '../services/session-cache.service';
import { PdfVectorService } from '../services/pdf-vector.service';
import { PdfRetrievalService } from '../services/pdf-retrieval.service';
import { ChatUploadController } from '../controllers/chat-upload.controller';
import { AgentRegistry } from '../agent-registry';
import { AgentOrchestrator } from '../agent-orchestrator';
import { LangChainService } from '../services/langchain.service';
import { LlmServiceMock } from '../../llm/llm.service.mock';

// Centralized setup for integration tests
export async function setupTestModule() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const mongoConnection = (await connect(uri)).connection;

  const mockChromaClient = {
    getOrCreateCollection: jest.fn().mockResolvedValue({
      add: jest.fn().mockResolvedValue(undefined),
    }),
  };

  const mockChromaService = {
    getClient: () => mockChromaClient,
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(uri),
      MongooseModule.forFeature([
        { name: ChatSession.name, schema: ChatSessionSchema },
      ]),
    ],
    controllers: [ChatController, ChatUploadController],
    providers: [
      ChatService,
      LangChainService,
      AgentRegistry,
      ChatSessionRepository,
      SessionCacheService,
      PdfVectorService,
      PdfRetrievalService,
      { provide: ChromaService, useValue: mockChromaService },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            const config = {
              'ai.provider': 'gemini',
              GEMINI_API_KEY: 'test-gemini-key',
              TAVILY_API_KEY: 'test-tavily-key',
              OPENWEATHER_API_KEY: 'test-weather-key',
            };
            return config[key] || null;
          }),
        },
      },
      {
        provide: LlmService,
        useClass: LlmServiceMock,
      },
    ],
  }).compile();

  // Mock AgentOrchestrator to control routing
  jest.spyOn(AgentOrchestrator, 'routeByConfidence').mockImplementation(
    async (agentNames, input, context, threshold) => {
      // Default to general agent if no specific mock is set
      return {
        agent: 'general',
        result: {
          output: 'This is a mocked LLM response.',
          confidence: 0.95,
        },
        all: {},
      };
    },
  );

  return {
    module,
    mongod,
    mongoConnection,
    cleanup: async () => {
      await mongoConnection.dropDatabase();
      await mongoConnection.close();
      await mongod.stop();
      AgentRegistry.clear();
      jest.restoreAllMocks();
    },
  };
}
