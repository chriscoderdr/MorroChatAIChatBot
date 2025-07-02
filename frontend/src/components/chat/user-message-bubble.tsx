import React from 'react';
import { isPdfUploadOnlyMessage, parseMessageContent } from '../../utils/message-parser';
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
  // Handle PDF-only messages separately
  if (isPdfUploadOnlyMessage(message)) {
    const parsed = parseMessageContent(message);
    return (
      <PdfUploadMessage
        fileName={parsed[0]?.fileName || 'unknown.pdf'}
        showActions={false}
        className={className}
      />
    );
  }

  // For all other messages (text, code, or mixed), use MarkdownRenderer
  return (
    <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 break-words overflow-wrap-anywhere ${className}`}>
      <MarkdownRenderer content={message} />
    </div>
  );
};
