import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  StoredMessage,
} from '@langchain/core/messages';
import { Model } from 'mongoose';
import {
  ChatSession,
  StoredMongoMessage,
} from '../schemas/chat-session.schema';

// This class is NOT decorated with @Injectable.
// It will be instantiated dynamically by LangChainService, which WILL have dependencies injected.
export class MongoDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ['langchain', 'stores', 'message', 'mongodb'];

  constructor(
    private readonly chatSessionModel: Model<ChatSession>,
    private readonly sessionId: string,
  ) {
    super();
  }

  async getMessages(): Promise<BaseMessage[]> {
    const session = await this.chatSessionModel.findOne({
      userId: this.sessionId,
    });

    // The data from Mongoose is structurally identical to StoredMessage[].
    // We can safely cast it to satisfy TypeScript.
    const storedMessages: StoredMessage[] =
      (session?.messages as StoredMessage[]) ?? [];

    console.log(
      `MongoDBChatMessageHistory: getMessages for session ${this.sessionId} - found ${storedMessages.length} messages`,
    );

    return mapStoredMessagesToChatMessages(storedMessages);
  }

  // This is the required abstract method from the base class.
  async addMessage(message: BaseMessage): Promise<void> {
    // The `map...` function converts a LangChain message into the savable StoredMessage format.
    const [storedMessage] = mapChatMessagesToStoredMessages([message]);

    console.log(
      `MongoDBChatMessageHistory: addMessage for session ${this.sessionId} - type: ${message._getType()}`,
    );

    try {
      await this.chatSessionModel.updateOne(
        { userId: this.sessionId },
        {
          $push: { messages: storedMessage as any }, // 'as any' is a pragmatic concession to Mongoose's deep type complexity with $push.
          $setOnInsert: { userId: this.sessionId },
        },
        { upsert: true }, // This will create the chat session document if it doesn't exist.
      );
    } catch (error) {
      console.error(
        `MongoDBChatMessageHistory: Error adding message for session ${this.sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.chatSessionModel.updateOne(
      { userId: this.sessionId },
      { $set: { messages: [] } },
    );
  }

  /**
   * Debug utility to directly log the message count for this session
   */
  async debugMessageCount(): Promise<number> {
    const session = await this.chatSessionModel.findOne({
      userId: this.sessionId,
    });
    const count = session?.messages?.length || 0;
    console.log(
      `MongoDBChatMessageHistory: Session ${this.sessionId} has ${count} messages`,
    );
    return count;
  }

  /**
   * Debug utility to show recent message history
   */
  async debugRecentMessages(limit: number = 3): Promise<void> {
    const session = await this.chatSessionModel.findOne({
      userId: this.sessionId,
    });
    if (!session || !session.messages || session.messages.length === 0) {
      console.log(
        `MongoDBChatMessageHistory: No messages found for session ${this.sessionId}`,
      );
      return;
    }

    const messages = session.messages.slice(-limit);
    console.log(
      `MongoDBChatMessageHistory: Last ${messages.length} messages for session ${this.sessionId}:`,
    );

    messages.forEach((msg: StoredMongoMessage, i: number) => {
      const type = msg.type || 'unknown';
      const contentPreview =
        typeof msg.data?.content === 'string'
          ? msg.data.content.substring(0, 50) +
            (msg.data.content.length > 50 ? '...' : '')
          : 'No content available';
      console.log(
        `[${i + 1}/${messages.length}] Type: ${type}, Content: ${contentPreview}`,
      );
    });
  }
}
