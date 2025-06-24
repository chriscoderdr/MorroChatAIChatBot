import React from 'react';
import MorroLogo from '../../assets/morro-logo.svg';

interface ChatAvatarProps {
  isUser?: boolean;
}

export const ChatAvatar: React.FC<ChatAvatarProps> = ({ isUser = false }) => {
  if (isUser) {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white">
        U
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 p-1">
        <img src={MorroLogo} alt="MorroChat Avatar" />
    </div>
  );
};