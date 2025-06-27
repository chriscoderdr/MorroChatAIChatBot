import { forwardRef } from 'react';
import MorroLogo from '../../assets/morro-logo.svg';

export const Header = forwardRef<HTMLDivElement>((_props, ref) => (
  <header ref={ref} className="flex items-center justify-between p-4">
    <div className="flex items-center gap-3">
      <img src={MorroLogo} alt="MorroChat Logo" className="h-8 w-8" />
      <h1 className="text-xl font-bold text-white">MorroChat</h1>
    </div>
  </header>
));
Header.displayName = 'Header';