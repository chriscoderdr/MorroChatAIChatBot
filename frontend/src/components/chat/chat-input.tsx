import React from 'react';

export const ChatInput: React.FC = () => {
  return (
    <div className="p-4 bg-gray-900">
      <div className="relative">
        <input
          type="text"
          placeholder="Message MorroChat..."
          className="w-full bg-gray-800 border border-gray-700 rounded-full py-3 px-6 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
       <p className="text-xs text-center text-gray-500 mt-2">
        MorroChat can make mistakes. Consider checking important information.
      </p>
    </div>
  );
};