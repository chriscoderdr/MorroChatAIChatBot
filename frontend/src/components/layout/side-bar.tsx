import React from 'react';
import { Button } from '../ui/button';

interface SidebarProps {
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
  return (
    <aside className="hidden md:flex w-full md:w-64 bg-gray-900 p-2 md:p-4 border-r border-gray-800 flex-col">
      <Button
        variant="primary"
        className="w-full py-2 md:py-3 text-base md:text-lg font-bold bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 shadow-lg hover:from-blue-600 hover:to-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-200 rounded-xl mb-2 animate-[popIn_0.3s_ease]"
        onClick={onNewChat}
        aria-label="Start a new chat session"
      >
        <span className="mr-2 text-xl md:text-2xl align-middle">＋</span> New Chat
      </Button>
      {/* Recent chats hidden for now */}
    </aside>
  );
};