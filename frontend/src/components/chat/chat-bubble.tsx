import React, { useState } from 'react';
import { MarkdownRenderer } from '../ui/markdown-renderer';
import { CodingTypingIndicator } from '../ui/coding-typing-indicator';
import { GeneralTypingIndicator } from '../ui/general-typing-indicator';
import { UserMessageBubble } from './user-message-bubble';
import { Copy, Check } from 'lucide-react';

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  isTyping?: boolean;
  isError?: boolean;
  isCodingRelated?: boolean;
  onRetry?: () => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isUser = false, 
  isTyping = false,
  isError = false,
  isCodingRelated = false,
  onRetry
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const bubbleClasses = isUser
    ? 'bg-blue-600 text-white'
    : isError 
      ? 'bg-red-900/60 text-gray-200 border border-red-700/60'
      : 'bg-gray-700 text-gray-200';

  if (isTyping) {
    return (
        <div className={`w-full max-w-xs sm:max-w-md md:max-w-4xl px-2 sm:px-4 py-2 sm:py-3 rounded-2xl break-words overflow-wrap-anywhere ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
            {isUser ? (
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
              </div>
            ) : isCodingRelated ? (
              <CodingTypingIndicator />
            ) : (
              <GeneralTypingIndicator />
            )}
        </div>
    )
  }

  // Show copy button only for non-typing, non-error, non-file-upload bubbles
  const showCopy = !isTyping && !isError && message && message.trim() && !message.startsWith('[PDF Uploaded]');

  return (
    <div className="w-full max-w-xs sm:max-w-md md:max-w-4xl break-words relative group">
      {isUser ? (
        <UserMessageBubble message={message} />
      ) : (
        <div className={`px-2 sm:px-4 py-2 sm:py-3 rounded-2xl ${bubbleClasses} break-words overflow-wrap-anywhere relative`}>
          {/* Copy button, top right, only on hover/focus, not for errors or typing */}
          {showCopy && (
            <button
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full p-1.5 transition-all duration-200 shadow-md border border-gray-700"
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
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {/* Tooltip */}
              <span className={`absolute -top-8 right-0 bg-gray-900 text-xs text-white px-2 py-1 rounded shadow transition-opacity duration-200 pointer-events-none ${showTooltip || copied ? 'opacity-100' : 'opacity-0'}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {copied ? 'Copied!' : 'Copy message'}
              </span>
            </button>
          )}
          <div className="text-xs sm:text-sm break-words overflow-wrap-anywhere">
            <MarkdownRenderer content={message} />
          </div>
          {isError && onRetry && (
            <div className="mt-2 sm:mt-3 flex items-center">
              <button 
                onClick={onRetry}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-md transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
