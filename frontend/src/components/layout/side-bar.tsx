import React from 'react';
import { Button } from '../ui/button';

export const Sidebar: React.FC = () => {
  // Mock data for chat history
  const chatHistory = [
    "Exploring the Dominican Republic",
    "React Best Practices 2025",
    "History of El Morro de Montecristi",
    "Tailwind CSS 4 new features",
  ];

  return (
    <aside className="w-64 bg-gray-900 p-4 border-r border-gray-800 flex flex-col">
      <Button variant="primary" className="w-full">+ New Chat</Button>
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent</h2>
        <ul className="mt-2 space-y-2">
          {chatHistory.map((chat, index) => (
            <li key={index}>
              <a href="#" className="block p-2 rounded-md text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                {chat}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};