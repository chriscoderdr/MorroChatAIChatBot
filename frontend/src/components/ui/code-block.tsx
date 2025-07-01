import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline }) => {
  const [copied, setCopied] = useState(false);
  
  // Extract language from className (format: "language-javascript")
  const language = className?.replace('language-', '') || 'text';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // For inline code, render a simple span
  if (inline) {
    return (
      <code className="bg-gray-700/50 text-purple-300 px-2 py-1 rounded text-sm font-mono border border-gray-600/40">
        {children}
      </code>
    );
  }

  // Enhanced language display with proper icons and colors
  const getLanguageInfo = (lang: string) => {
    const langMap: Record<string, { display: string; color: string; icon: string }> = {
      javascript: { display: 'JavaScript', color: 'text-yellow-400', icon: '🟨' },
      typescript: { display: 'TypeScript', color: 'text-blue-400', icon: '🔷' },
      python: { display: 'Python', color: 'text-green-400', icon: '🐍' },
      java: { display: 'Java', color: 'text-orange-400', icon: '☕' },
      css: { display: 'CSS', color: 'text-blue-300', icon: '🎨' },
      html: { display: 'HTML', color: 'text-orange-300', icon: '🌐' },
      json: { display: 'JSON', color: 'text-gray-300', icon: '📄' },
      sql: { display: 'SQL', color: 'text-purple-400', icon: '🗃️' },
      bash: { display: 'Shell', color: 'text-green-300', icon: '💻' },
      text: { display: 'Code', color: 'text-gray-400', icon: '📝' },
    };
    
    return langMap[lang] || { display: lang.toUpperCase(), color: 'text-gray-400', icon: '📝' };
  };

  const langInfo = getLanguageInfo(language);

  return (
    <div className="relative group my-4 code-block-container">
      <div className="flex items-center justify-between bg-gray-800/90 backdrop-blur-sm px-4 py-3 rounded-t-lg border border-gray-600/30 border-b-gray-700/60 code-block-header">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-sm"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{langInfo.icon}</span>
            <span className={`text-sm font-medium ${langInfo.color}`}>
              {langInfo.display}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500 hidden sm:block">
            {children.split('\n').length} lines
          </div>
          <Button
            onClick={handleCopy}
            variant="secondary"
            className="p-2 h-auto bg-transparent hover:bg-gray-700/80 text-gray-400 hover:text-white border-none transition-all duration-200 relative"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-400" />
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Copy code
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto border border-t-0 border-gray-600/30 rounded-b-lg bg-gray-900/95">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            padding: '1.25rem',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }
          }}
          showLineNumbers={children.split('\n').length > 5}
          lineNumberStyle={{
            color: '#6b7280',
            borderRight: '1px solid #374151',
            paddingRight: '1rem',
            marginRight: '1rem',
            fontSize: '0.75rem',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
