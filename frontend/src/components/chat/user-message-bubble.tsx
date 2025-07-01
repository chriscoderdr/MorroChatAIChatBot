import React from 'react';
import { parseMessageContent, hasCodeBlocks } from '../../utils/message-parser';
import { CodeSnippetCard } from '../ui/code-snippet-card';

interface UserMessageBubbleProps {
  message: string;
  className?: string;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ 
  message, 
  className = '' 
}) => {
  const parsedContent = parseMessageContent(message);
  const containsCode = hasCodeBlocks(message);

  // If no code blocks, render as simple text
  if (!containsCode) {
    return (
      <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 ${className}`}>
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
    );
  }

  // Render with code blocks
  return (
    <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 space-y-3 ${className}`}>
      {parsedContent.map((part, index) => {
        if (part.type === 'text') {
          return (
            <p key={index} className="text-sm whitespace-pre-wrap">
              {part.content}
            </p>
          );
        } else if (part.type === 'code') {
          return (
            <div key={index} className="not-prose">
              <CodeSnippetCard
                code={part.content}
                language={part.language}
                className="bg-gray-900 border-gray-600"
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};
