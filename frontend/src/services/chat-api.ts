import axios from 'axios';
import type { ChatHistory, ChatMessage } from '../models/chatMessage';

export interface SendMessagePayload {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This enables sending cookies with cross-origin requests
});

export const sendMessage = async (payload: SendMessagePayload): Promise<ChatResponse> => {
  try {
    const response = await apiClient.post<ChatResponse>('/chat', payload);

    await new Promise(resolve => setTimeout(resolve, 500));
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle Axios-specific errors
      console.error('Error sending message:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get a response from the server.');
    }
    // Handle generic errors
    console.error('An unexpected error occurred:', error);
    throw new Error('An unexpected error occurred.');
  }
};

export const fetchChatHistory = async (): Promise<ChatHistory> => {
  try {
    const response = await apiClient.get<ChatMessage[]>('/chat/history');
    
    // Convert the array of messages into the ChatHistory format
    const chatHistory: ChatHistory = {
      sessionId: 'current-session', // You can use a default or get this from elsewhere if needed
      messages: response.data,
      hasMessages: response.data.length > 0
    };
    
    return chatHistory;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error fetching chat history:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch chat history from the server.');
    }
    console.error('An unexpected error occurred:', error);
    throw new Error('An unexpected error occurred while fetching chat history.');
  }
};