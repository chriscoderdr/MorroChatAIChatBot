
export type ChatMessageType = 'human' | 'ai';

export interface ChatMessage {
    type: ChatMessageType;
    data: {
        content: string;
        tool_calls?: any[]; // Only for AI, optional
    };
}

export interface ChatHistory {
    sessionId: string;
    messages: ChatMessage[];
    hasMessages: boolean;
}