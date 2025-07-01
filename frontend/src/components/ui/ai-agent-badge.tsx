import React from 'react';
import { Code2, Sparkles } from 'lucide-react';

interface AiAgentBadgeProps {
  className?: string;
}

export const AiAgentBadge: React.FC<AiAgentBadgeProps> = ({ className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300 ${className}`}>
      <div className="relative">
        <Code2 className="w-3 h-3" />
        <Sparkles className="w-2 h-2 absolute -top-0.5 -right-0.5 text-yellow-400 animate-pulse" />
      </div>
      <span>Coding Agent</span>
    </div>
  );
};
