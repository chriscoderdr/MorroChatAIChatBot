import { useMutation } from '@tanstack/react-query';
import { sendMessage, type SendMessagePayload, type ChatResponse } from '../services/chat-api';

/**
 * Custom hook to handle sending a message to the chat API.
 * It provides the mutation function and its state (loading, error, etc.).
 */
export const useChatMutation = () => {
  return useMutation<ChatResponse, Error, SendMessagePayload>({
    mutationFn: sendMessage,
  });
};