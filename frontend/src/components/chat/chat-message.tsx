import React from 'react';
import { ChatAvatar } from './chat-avatar';
import { ChatBubble } from './chat-bubble';

interface ChatMessageProps {
  message: {
    text: string;
    isUser: boolean;
    isError?: boolean;
  };
  onRetry?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry }) => {
  const alignmentClass = message.isUser ? 'justify-end' : 'justify-start';
  
  // Check if this is an error message
  const isError = message.isError || (!message.isUser && message.text.startsWith('Error:'));
  
  // Check if this is a typing indicator
  const isTyping = !message.isUser && message.text === '';

  return (
    <div className={`flex items-start gap-3 ${alignmentClass}`}>
      {!message.isUser && <ChatAvatar />}
      <ChatBubble 
        message={message.text} 
        isUser={message.isUser} 
        isTyping={isTyping}
        isError={isError}
        onRetry={isError ? onRetry : undefined}
      />
      {message.isUser && <ChatAvatar isUser />}
    </div>
  );
};