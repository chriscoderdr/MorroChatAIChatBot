import React from 'react';
import { ChatAvatar } from './chat-avatar';
import { ChatBubble } from './chat-bubble';
import { AiAgentBadge } from '../ui/ai-agent-badge';
import { E2EEIndicator } from '../ui/e2ee-indicator';

interface ChatMessageProps {
  message: {
    text: string;
    isUser: boolean;
    isError?: boolean;
  };
  isCodingRelated?: boolean;
  onRetry?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCodingRelated = false, onRetry }) => {
  const alignmentClass = message.isUser ? 'justify-end' : 'justify-start';
  
  // Check if this is an error message
  const isError = message.isError || (!message.isUser && message.text.startsWith('Error:'));
  
  // Check if this is a typing indicator
  const isTyping = !message.isUser && message.text === '';

  // Check if this looks like a coding response (contains code blocks or programming terms)
  const isCodingResponse = !message.isUser && !isTyping && !isError && (
    message.text.includes('```') || 
    message.text.includes('function') ||
    message.text.includes('const ') ||
    message.text.includes('let ') ||
    message.text.includes('var ') ||
    message.text.includes('optimization') ||
    message.text.includes('algorithm') ||
    message.text.includes('complexity') ||
    message.text.includes('performance')
  );

  return (
    <div className={`flex flex-col gap-2 ${alignmentClass}`}>
      <div className={`flex items-start gap-3 ${alignmentClass}`}>
        {!message.isUser && <ChatAvatar />}
        <div className="flex flex-col gap-1">
          <ChatBubble 
            message={message.text} 
            isUser={message.isUser} 
            isTyping={isTyping}
            isError={isError}
            isCodingRelated={isCodingRelated}
            onRetry={isError ? onRetry : undefined}
          />
          {/* E2EE indicator below each message bubble */}
          <div className="mt-1 flex items-center gap-2">
            <E2EEIndicator className="shadow-none" tooltip="This message is end-to-end encrypted" />
            {isCodingResponse && !message.isUser && <AiAgentBadge />}
          </div>
        </div>
        {message.isUser && <ChatAvatar isUser />}
      </div>
    </div>
  );
};