
import React, { useState } from 'react';
import { Menu, HelpCircle } from 'lucide-react';
import MorroLogo from '../../assets/morro-logo.svg';
import { E2EEIndicator } from '../ui/e2ee-indicator';
import { PrivacyPolicyModal } from '../ui/privacy-policy-modal';
import { FAQModal } from '../ui/faq-modal';


type HeaderProps = {
  onToggleSidebar?: () => void;
  isSidebarVisible?: boolean;
  onOpenFaq?: () => void;
  onOpenPrivacy?: () => void;
};


export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, isSidebarVisible = true, onOpenFaq, onOpenPrivacy }) => {
  return (
    <header className="flex items-center justify-between p-4">
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
      {/* E2EE Indicator, Privacy Policy, and FAQ/Help link */}
      <div className="hidden sm:flex items-center gap-4">
        <span className="h-6 border-l border-gray-700 mx-2" aria-hidden="true"></span>
        <E2EEIndicator />
        <button
          className="text-xs text-blue-300 hover:text-blue-200 underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1 transition-colors"
          onClick={onOpenPrivacy}
          aria-label="View privacy policy"
        >
          Privacy Policy
        </button>
        <button
          className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1 transition-colors"
          onClick={onOpenFaq}
          aria-label="Help & FAQ"
        >
          <HelpCircle className="w-4 h-4" />
          Help
        </button>
      </div>
    </header>
  );
};