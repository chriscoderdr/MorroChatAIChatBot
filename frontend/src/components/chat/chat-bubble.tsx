import React from 'react';

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isUser = false }) => {
  const bubbleClasses = isUser
    ? 'bg-blue-600 text-white'
    : 'bg-gray-700 text-gray-200';

  return (
    <div className={`max-w-xl px-4 py-3 rounded-2xl ${bubbleClasses}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
};