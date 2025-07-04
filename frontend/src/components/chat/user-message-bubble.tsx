import React, { useState } from 'react';
import { isPdfUploadOnlyMessage, parseMessageContent } from '../../utils/message-parser';
import { MarkdownRenderer } from '../ui/markdown-renderer';
import { PdfUploadMessage } from './pdf-upload-message';
import { Copy, Check } from 'lucide-react';

interface UserMessageBubbleProps {
  message: string;
  className?: string;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({
  message,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
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
    <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 break-words overflow-wrap-anywhere relative group ${className}`}>
      {/* Copy button, top right, only on hover/focus */}
      {message && message.trim() && !message.startsWith('[PDF Uploaded]') && (
        <button
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-blue-700/80 hover:bg-blue-800 text-white hover:text-green-300 rounded-full p-1.5 transition-all duration-200 shadow-md border border-blue-400"
          style={{ outline: 'none' }}
          aria-label={copied ? 'Copied!' : 'Copy message'}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
        >
          {copied ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
          {/* Tooltip */}
          <span className={`absolute -top-8 right-0 bg-gray-900 text-xs text-white px-2 py-1 rounded shadow transition-opacity duration-200 pointer-events-none ${showTooltip || copied ? 'opacity-100' : 'opacity-0'}`}
            style={{ whiteSpace: 'nowrap' }}
          >
            {copied ? 'Copied!' : 'Copy message'}
          </span>
        </button>
      )}
      <MarkdownRenderer content={message} />
    </div>
  );
};
