import React, { forwardRef } from 'react';
import MorroLogo from '../../assets/morro-logo.svg';

export const Header = forwardRef<HTMLDivElement>((props, ref) => (
  <header ref={ref} className="flex items-center justify-between p-4 border-b border-gray-700">
    <div className="flex items-center gap-3">
      <img src={MorroLogo} alt="MorroChat Logo" className="h-8 w-8" />
      <h1 className="text-xl font-bold text-white">MorroChat</h1>
    </div>
    {/* You can add user profile/settings icon here */}
  </header>
));
Header.displayName = 'Header';