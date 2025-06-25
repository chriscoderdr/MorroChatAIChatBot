import React from 'react';
import MorroLogo from '../../assets/morro-logo.svg';

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-700">
      <div className="flex items-center gap-2 sm:gap-3">
        <img src={MorroLogo} alt="MorroChat Logo" className="h-7 w-7 sm:h-8 sm:w-8" />
        <h1 className="text-lg sm:text-xl font-bold text-white">MorroChat</h1>
      </div>
      {/* You can add user profile/settings icon here */}
    </header>
  );
};