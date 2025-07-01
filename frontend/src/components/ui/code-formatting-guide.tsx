import React, { useState } from 'react';
import { Code2, X, Copy, Check } from 'lucide-react';

export const CodeFormattingGuide: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

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

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Code2 className="h-3 w-3" />
        How to format code?
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Code2 className="h-5 w-5 text-blue-400" />
            Code Formatting Guide
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-300 mb-2">How to format code blocks:</h4>
            <div className="bg-gray-900 border border-gray-600 rounded p-3 text-sm">
              <p className="text-gray-300 mb-2">Use triple backticks (```) to wrap your code:</p>
              <pre className="text-blue-400">```language
your code here
```</pre>
              <p className="text-gray-400 mt-2 text-xs">
                Replace "language" with: javascript, python, java, cpp, etc. Or use "code" for general code.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-300">Example templates:</h4>
            {examples.map((example, index) => (
              <div key={index} className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-medium text-white">{example.title}</h5>
                    <p className="text-xs text-gray-400">{example.description}</p>
                  </div>
                  <button
                    onClick={() => copyExample(example.code)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    {copiedExample === example.code ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-sm text-gray-300 bg-gray-800 p-3 rounded overflow-x-auto">
                  {example.code}
                </pre>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/40 rounded-lg">
            <h5 className="font-medium text-blue-300 mb-2">💡 Pro Tips:</h5>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Use specific language names (javascript, python) for better syntax highlighting</li>
              <li>• Use "code" as a general language for any programming language</li>
              <li>• Include context in your message (what you want: optimization, debugging, review)</li>
              <li>• You can include multiple code blocks in one message</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
