import React from 'react';
import { ChatAvatar } from './chat-avatar';
import { ChatBubble } from './chat-bubble';

interface ChatMessageProps {
  message: {
    text: string;
    isUser: boolean;
  };
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const alignmentClass = message.isUser ? 'justify-end' : 'justify-start';

  return (
    <div className={`flex items-start gap-3 ${alignmentClass}`}>
      {!message.isUser && <ChatAvatar />}
      <ChatBubble message={message.text} isUser={message.isUser} />
      {message.isUser && <ChatAvatar isUser />}
    </div>
  );
};