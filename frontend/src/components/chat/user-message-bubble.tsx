import React from 'react';
import { MarkdownRenderer } from '../ui/markdown-renderer';

interface UserMessageBubbleProps {
  message: string;
  className?: string;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ 
  message, 
  className = '' 
}) => {
  return (
    <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 break-words overflow-wrap-anywhere ${className}`}>
      <MarkdownRenderer content={message} />
    </div>
  );
};
