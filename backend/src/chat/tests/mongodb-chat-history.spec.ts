import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from '../../config/app.config';
import aiConfig from '../../config/ai.config';
import databaseConfig from '../../config/database.config';
import throttleConfig from '../../config/throttle.config';
import { ChatModule } from '../chat.module';
import { MongoDBChatMessageHistory } from '../services/mongodb.chat.message.history';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatSession, ChatSessionSchema } from '../schemas/chat-session.schema';
import { Model } from 'mongoose';

describe('MongoDB Chat Message History', () => {
  let moduleRef: TestingModule;
  let chatSessionModel: Model<ChatSession>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig, aiConfig, databaseConfig, throttleConfig],
          isGlobal: true,
        }),
        MongooseModule.forRootAsync({
          useFactory: () => ({
            uri: process.env.MONGO_URI || 'mongodb://localhost:27017/test',
          }),
        }),
        MongooseModule.forFeature([
          { name: ChatSession.name, schema: ChatSessionSchema },
        ]),
        ChatModule,
      ],
    }).compile();

    chatSessionModel = moduleRef.get('ChatSessionModel');
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should persist and retrieve messages', async () => {
    const sessionId = `test-${Date.now()}`;
    const history = new MongoDBChatMessageHistory(chatSessionModel, sessionId);

    // Add test messages
    await history.addMessage(new HumanMessage('Hello'));
    await history.addMessage(new AIMessage('Hi there!'));
    await history.addMessage(new HumanMessage('How are you?'));
    await history.addMessage(new AIMessage('I am doing well, thank you!'));

    // Retrieve the messages
    const messages = await history.getMessages();

    // Verify
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
    expect(messages[2].content).toBe('How are you?');
    expect(messages[3].content).toBe('I am doing well, thank you!');

    // Clear the messages
    await history.clear();

    // Verify messages were cleared
    const clearedMessages = await history.getMessages();
    expect(clearedMessages).toHaveLength(0);
  });

  it('should handle concurrent message additions correctly', async () => {
    const sessionId = `concurrent-test-${Date.now()}`;
    const history = new MongoDBChatMessageHistory(chatSessionModel, sessionId);

    // Add multiple messages concurrently
    await Promise.all([
      history.addMessage(new HumanMessage('Message 1')),
      history.addMessage(new HumanMessage('Message 2')),
      history.addMessage(new HumanMessage('Message 3')),
      history.addMessage(new AIMessage('Response 1')),
      history.addMessage(new AIMessage('Response 2')),
      history.addMessage(new AIMessage('Response 3')),
    ]);

    // Verify all messages were saved
    const messages = await history.getMessages();
    expect(messages.length).toBe(6);

    // Verify message types
    const humanMessages = messages.filter((m) => m._getType() === 'human');
    const aiMessages = messages.filter((m) => m._getType() === 'ai');
    expect(humanMessages).toHaveLength(3);
    expect(aiMessages).toHaveLength(3);

    // Clean up
    await history.clear();
  });
});
