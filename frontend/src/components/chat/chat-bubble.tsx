import React from 'react';

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  isTyping?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isUser = false, isTyping = false }) => {
  const bubbleClasses = isUser
    ? 'bg-blue-600 text-white'
    : 'bg-gray-700 text-gray-200';

  if (isTyping) {
    return (
        <div className={`max-w-xl px-4 py-3 rounded-2xl ${bubbleClasses} flex items-center space-x-1`}>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
        </div>
    )
  }

  return (
    <div className={`max-w-xl px-4 py-3 rounded-2xl ${bubbleClasses}`}>
      <p className="text-sm whitespace-pre-wrap">{message}</p>
    </div>
  );
};