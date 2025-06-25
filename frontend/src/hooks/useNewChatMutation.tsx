import { useMutation } from '@tanstack/react-query';
import { startNewChat, type NewChatResponse } from '../services/new-chat-api';

export const useNewChatMutation = () => {
  return useMutation<NewChatResponse, Error, void>({
    mutationFn: startNewChat,
  });
};
