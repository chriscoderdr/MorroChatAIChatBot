import React from 'react';
import { parseMessageContent, hasCodeBlocks, hasPdfUploads } from '../../utils/message-parser';
import { CodeSnippetCard } from '../ui/code-snippet-card';
import { PdfUploadMessage } from './pdf-upload-message';

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
  const containsPdf = hasPdfUploads(message);

  // If no code blocks or PDF uploads, render as simple text
  if (!containsCode && !containsPdf) {
    return (
      <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 ${className}`}>
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
    );
  }

  // Render with mixed content (text, code blocks, PDF uploads)
  return (
    <div className={`space-y-3 ${className}`}>
      {parsedContent.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div key={index} className="bg-blue-600 text-white rounded-2xl px-4 py-3">
              <p className="text-sm whitespace-pre-wrap">{part.content}</p>
            </div>
          );
        } else if (part.type === 'code') {
          return (
            <div key={index} className="bg-blue-600 text-white rounded-2xl px-4 py-3">
              <div className="not-prose">
                <CodeSnippetCard
                  code={part.content}
                  language={part.language}
                  className="bg-gray-900 border-gray-600"
                />
              </div>
            </div>
          );
        } else if (part.type === 'pdf_upload') {
          return (
            <PdfUploadMessage
              key={index}
              fileName={part.fileName || 'unknown.pdf'}
              showActions={false}
            />
          );
        }
        return null;
      })}
    </div>
  );
};
