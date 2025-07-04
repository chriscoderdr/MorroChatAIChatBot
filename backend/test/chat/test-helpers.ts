import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model } from 'mongoose';
import { LlmService } from '../../src/llm/llm.service';
import { ChromaService } from '../../src/chat/services/chroma.service';
import {
  ChatSession,
  ChatSessionSchema,
} from '../../src/chat/schemas/chat-session.schema';
import { ChatController } from '../../src/chat/controllers/chat.controller';
import { ChatService } from '../../src/chat/services/chat.service';
import { ChatSessionRepository } from '../../src/chat/repositories/chat-session.repository';
import { SessionCacheService } from '../../src/chat/services/session-cache.service';
import { PdfVectorService } from '../../src/chat/services/pdf-vector.service';
import { PdfRetrievalService } from '../../src/chat/services/pdf-retrieval.service';
import { ChatUploadController } from '../../src/chat/controllers/chat-upload.controller';
import { AgentRegistry } from '../../src/chat/agent-registry';
import { AgentOrchestrator } from '../../src/chat/agent-orchestrator';
import { LangChainService } from '../../src/chat/services/langchain.service';
import { LlmServiceMock } from '../llm.service.mock';
import { agents } from '../../src/chat/agents.providers';

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
      ...agents,
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
