import { forwardRef } from 'react';
import { Menu } from 'lucide-react';
import MorroLogo from '../../assets/morro-logo.svg';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarVisible?: boolean;
}

export const Header = forwardRef<HTMLDivElement, HeaderProps>(({ onToggleSidebar, isSidebarVisible = true }, ref) => (
  <header ref={ref} className="flex items-center justify-between p-4">
    <div className="flex items-center gap-3">
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
            isSidebarVisible 
              ? 'bg-gray-800 hover:bg-gray-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
          title={`${isSidebarVisible ? "Hide sidebar" : "Show sidebar"} (Ctrl+B)`}
        >
          <Menu className={`h-4 w-4 transition-colors ${
            isSidebarVisible 
              ? 'text-gray-400 group-hover:text-white' 
              : 'text-white'
          }`} />
        </button>
      )}
      <img src={MorroLogo} alt="MorroChat Logo" className="h-8 w-8" />
      <h1 className="text-xl font-bold text-white">MorroChat</h1>
    </div>
  </header>
));
Header.displayName = 'Header';