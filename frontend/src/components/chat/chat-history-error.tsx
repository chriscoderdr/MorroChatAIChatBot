import React from 'react';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';

interface ChatHistoryErrorProps {
  error: Error | null;
  onRetry: () => void;
}

export const ChatHistoryError: React.FC<ChatHistoryErrorProps> = ({ error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg mb-4">
        <p className="font-medium">Failed to load chat history</p>
        {error && <p className="text-sm mt-1">{error.message}</p>}
      </div>
      <Button onClick={onRetry} className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
};
