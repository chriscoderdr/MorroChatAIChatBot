import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  StoredMessage,
} from "@langchain/core/messages";
import { Model } from "mongoose";
import { ChatSession } from "../schemas/chat-session.schema";

// This class is NOT decorated with @Injectable.
// It will be instantiated dynamically by LangChainService, which WILL have dependencies injected.
export class MongoDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "mongodb"];

  constructor(
    private readonly chatSessionModel: Model<ChatSession>,
    private readonly sessionId: string,
  ) {
    super();
  }

  async getMessages(): Promise<BaseMessage[]> {
    const session = await this.chatSessionModel.findOne({ userId: this.sessionId });
    
    // The data from Mongoose is structurally identical to StoredMessage[].
    // We can safely cast it to satisfy TypeScript.
    const storedMessages: StoredMessage[] = (session?.messages as StoredMessage[]) ?? [];
    
    return mapStoredMessagesToChatMessages(storedMessages);
  }

  // This is the required abstract method from the base class.
  async addMessage(message: BaseMessage): Promise<void> {
    // The `map...` function converts a LangChain message into the savable StoredMessage format.
    const [storedMessage] = mapChatMessagesToStoredMessages([message]);
    
    await this.chatSessionModel.updateOne(
      { userId: this.sessionId },
      {
        $push: { messages: storedMessage as any }, // 'as any' is a pragmatic concession to Mongoose's deep type complexity with $push.
        $setOnInsert: { userId: this.sessionId },
      },
      { upsert: true }, // This will create the chat session document if it doesn't exist.
    );
  }

  async clear(): Promise<void> {
    await this.chatSessionModel.updateOne(
        { userId: this.sessionId },
        { $set: { messages: [] } }
    );
  }
}