import React from 'react';

export const WelcomeMessage: React.FC = () => {
  return (
    <div className="text-center p-12">
      <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
        Hello, I'm MorroChat
      </h1>
      <p className="text-lg text-gray-400 mt-4">
        Your AI companion inspired by the beauty of Montecristi.
      </p>
    </div>
  );
};