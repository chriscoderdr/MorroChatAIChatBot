import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/chat-api';

export interface NewChatResponse {
  message?: string;
}

export const useNewChatMutation = () => {
  return useMutation<NewChatResponse, Error, void>({
    mutationFn: async () => {
      try {
        const res = await apiClient.post<NewChatResponse>('/chat/new');
        return res.data;
      } catch (error: any) {
        if (error && error.response && error.response.data && error.response.data.message) {
          throw new Error(error.response.data.message);
        }
        throw new Error('Failed to start new chat session');
      }
    },
  });
};
