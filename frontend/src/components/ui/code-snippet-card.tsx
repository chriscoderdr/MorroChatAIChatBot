import React from 'react';
import { Copy, Check, Code2 } from 'lucide-react';
import { useState } from 'react';

interface CodeSnippetCardProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export const CodeSnippetCard: React.FC<CodeSnippetCardProps> = ({ 
  code, 
  language = 'code', 
  title,
  className = '' 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const displayLanguage = language === 'code' ? 'Code' : language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-900/50 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">
            {title || displayLanguage}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      {/* Code Content */}
      <div className="p-3">
        <pre className="text-sm text-gray-300 overflow-x-auto">
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>
    </div>
  );
};
