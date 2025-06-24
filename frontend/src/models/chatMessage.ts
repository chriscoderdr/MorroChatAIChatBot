export interface ChatMessage {
    message: string;
    role: 'user' | 'ai';
    timestamp: string;
    _id: string;
}

export interface ChatHistory {
    sessionId: string;
    messages: ChatMessage[];
    hasMessages: boolean;
}