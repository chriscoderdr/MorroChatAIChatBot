import React from 'react';
import { parseMessageContent } from '../../utils/message-parser';
import { MarkdownRenderer } from '../ui/markdown-renderer';
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

  return (
    <div className={`space-y-3 break-words overflow-wrap-anywhere ${className}`}>
      {parsedContent.map((part, index) => {
        if (part.type === 'pdf_upload') {
          return (
            <PdfUploadMessage
              key={index}
              fileName={part.fileName || 'unknown.pdf'}
              showActions={false}
            />
          );
        }
        // For text and code, we can use the MarkdownRenderer
        return (
          <div key={index} className="bg-blue-600 text-white rounded-2xl px-4 py-3 break-words overflow-wrap-anywhere">
            <MarkdownRenderer content={part.content} />
          </div>
        );
      })}
    </div>
  );
};
