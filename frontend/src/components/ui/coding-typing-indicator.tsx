import React from 'react';
import { Code2, Brain } from 'lucide-react';

interface CodingTypingIndicatorProps {
  className?: string;
}

export const CodingTypingIndicator: React.FC<CodingTypingIndicatorProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-3 py-4 px-4 ${className}`}>
      <div className="relative">
        <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Code2 className="w-4 h-4 text-gray-400" />
        <div className="flex space-x-1">
          <span className="text-gray-400 text-sm">Analyzing code</span>
          <span className="animate-pulse [animation-delay:0ms]">.</span>
          <span className="animate-pulse [animation-delay:300ms]">.</span>
          <span className="animate-pulse [animation-delay:600ms]">.</span>
        </div>
      </div>
      
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
};
