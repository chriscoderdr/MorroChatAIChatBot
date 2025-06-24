import { useQuery } from '@tanstack/react-query';
import { fetchChatHistory } from '../services/chat-api';
import type { ChatHistory } from '../models/chatMessage';

/**
 * Custom hook to fetch the chat history from the API.
 * It provides the query data and its state (loading, error, etc.).
 */
export const useChatHistory = () => {
  return useQuery<ChatHistory, Error>({
    queryKey: ['chatHistory'],
    queryFn: fetchChatHistory,
  });
};
