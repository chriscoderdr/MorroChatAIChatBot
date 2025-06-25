import { apiClient } from './chat-api';

export interface NewChatResponse {
  message?: string;
}

export const startNewChat = async (): Promise<NewChatResponse> => {
  try {
    const response = await apiClient.post<NewChatResponse>('/chat/new');
    return response.data;
  } catch (error: any) {
    if (error && error.response && error.response.data && error.response.data.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Failed to start new chat session');
  }
};
