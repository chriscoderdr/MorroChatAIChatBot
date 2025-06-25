import { useMutation } from '@tanstack/react-query';
import { startNewChat, type NewChatResponse } from '../services/chat-api';

export const useNewChatMutation = () => {
  return useMutation<NewChatResponse, Error, void>({
    mutationFn: startNewChat,
  });
};
