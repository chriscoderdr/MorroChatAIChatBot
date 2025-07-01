import React, { useEffect } from 'react';
import { Code2, X, Copy, Check } from 'lucide-react';

interface CodeFormattingGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeFormattingGuide: React.FC<CodeFormattingGuideProps> = ({ isOpen, onClose }) => {
  const [copiedExample, setCopiedExample] = React.useState<string | null>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const examples = [
    {
      title: 'General Code Analysis',
      description: 'For any programming language',
      code: 'Optimize this:\n```code\n// Your code here\nfunction example() {\n  return "Hello World";\n}\n```'
    },
    {
      title: 'JavaScript/TypeScript',
      description: 'For JavaScript or TypeScript code',
      code: 'Debug this JavaScript:\n```javascript\nconst data = [1, 2, 3];\nfor (let i = 0; i <= data.length; i++) {\n  console.log(data[i]);\n}\n```'
    },
    {
      title: 'Python Code',
      description: 'For Python code analysis',
      code: 'Review this Python function:\n```python\ndef slow_function():\n    result = []\n    for i in range(1000):\n        for j in range(1000):\n            result.append(i * j)\n    return result\n```'
    },
    {
      title: 'Performance Review',
      description: 'Ask for performance optimization',
      code: 'Analyze the performance of:\n```code\n// Your algorithm here\n```\n\nWhat are the time and space complexities?'
    }
  ];

  const copyExample = async (example: string) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(example);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (err) {
      console.error('Failed to copy example:', err);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-4xl w-full h-fit max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750">
          <h3 className="text-xl font-semibold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Code2 className="h-6 w-6 text-blue-400" />
            </div>
            Code Formatting Guide
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-all duration-200 p-2 hover:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="mb-8">
            <h4 className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
              <span className="text-blue-400">📝</span>
              How to format code blocks:
            </h4>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 text-sm relative">
              <div className="absolute top-3 right-3 flex gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
              </div>
              <p className="text-gray-300 mb-3 mt-2">Use triple backticks (```) to wrap your code:</p>
              <pre className="text-blue-400 bg-gray-800 p-3 rounded font-mono text-sm border border-gray-700">```language
your code here
```</pre>
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded">
                <p className="text-gray-300 text-sm">
                  <span className="font-medium text-blue-300">💡 Tip:</span> Replace "language" with: 
                  <code className="mx-1 px-2 py-1 bg-gray-700 rounded text-xs">javascript</code>
                  <code className="mx-1 px-2 py-1 bg-gray-700 rounded text-xs">python</code>
                  <code className="mx-1 px-2 py-1 bg-gray-700 rounded text-xs">java</code>
                  <code className="mx-1 px-2 py-1 bg-gray-700 rounded text-xs">cpp</code> 
                  or use <code className="mx-1 px-2 py-1 bg-gray-700 rounded text-xs">code</code> for general code.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-lg font-medium text-gray-200 flex items-center gap-2">
              <span className="text-green-400">⚡</span>
              Ready-to-use templates:
            </h4>
            <div className="grid gap-4">
              {examples.map((example, index) => (
                <div key={index} className="bg-gray-900 border border-gray-600 rounded-lg p-5 hover:border-gray-500 transition-all duration-200 group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h5 className="font-medium text-white mb-1 group-hover:text-blue-300 transition-colors">{example.title}</h5>
                      <p className="text-sm text-gray-400">{example.description}</p>
                    </div>
                    <button
                      onClick={() => copyExample(example.code)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                    >
                      {copiedExample === example.code ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="text-sm text-gray-300 bg-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-700 font-mono leading-relaxed">
                      {example.code}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 p-5 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 rounded-xl">
            <h5 className="font-medium text-blue-300 mb-3 flex items-center gap-2">
              <span className="text-xl">💡</span>
              Pro Tips for Better Results:
            </h5>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-300">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Use specific language names for better syntax highlighting</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Include context about what you want (optimization, debugging, review)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>You can include multiple code blocks in one message</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Use descriptive variable names in your examples</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
