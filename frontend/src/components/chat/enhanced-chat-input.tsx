import React, { useState, forwardRef, useRef, useEffect } from 'react';
import { FileUpload } from './file-upload';
import { Code2, Eye, EyeOff, Lightbulb } from 'lucide-react';

interface EnhancedChatInputProps {
    onSendMessage: (message: string, file?: File | null) => void;
    isLoading: boolean;
    isCodeGuideOpen?: boolean;
    setIsCodeGuideOpen: (isOpen: boolean) => void;
}

const COMMON_LANGUAGES = [
    'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 
    'rust', 'php', 'ruby', 'swift', 'kotlin', 'html', 'css', 'sql', 'bash'
];

const CODE_SUGGESTIONS = [
    {
        label: 'Code Analysis',
        template: 'Optimize this:\n```code\n// Your code here\n```',
        description: 'Request optimization of your code'
    },
    {
        label: 'Debug Help',
        template: 'Debug this code:\n```javascript\n// Your problematic code here\n```',
        description: 'Get help debugging issues'
    },
    {
        label: 'Performance Review',
        template: 'Review the performance of:\n```code\n// Your code here\n```',
        description: 'Analyze code performance'
    }
];

export const EnhancedChatInput = forwardRef<HTMLDivElement, EnhancedChatInputProps>(({ onSendMessage, isLoading, setIsCodeGuideOpen }, ref) => {
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showCodeHelper, setShowCodeHelper] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSend = () => {
        if ((input.trim() || selectedFile) && !isLoading) {
            onSendMessage(input.trim(), selectedFile);
            setInput('');
            setSelectedFile(null);
            setShowPreview(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && (input.trim() || selectedFile)) {
            event.preventDefault();
            handleSend();
        }
    };

    const insertCodeBlock = (language: string = 'code') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = input.substring(start, end);
        
        const codeBlock = selectedText 
            ? `\`\`\`${language}\n${selectedText}\n\`\`\``
            : `\`\`\`${language}\n// Your code here\n\`\`\``;
        
        const newValue = input.substring(0, start) + codeBlock + input.substring(end);
        setInput(newValue);
        
        // Set cursor position inside the code block
        setTimeout(() => {
            const newPosition = selectedText 
                ? start + codeBlock.length 
                : start + language.length + 7; // Position after "```language\n"
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
        }, 0);
    };

    const insertTemplate = (template: string) => {
        setInput(template);
        setShowCodeHelper(false);
        textareaRef.current?.focus();
    };

    const hasCodeBlock = input.includes('```');

    return (
        <div
            ref={ref}
            className="p-2 sm:p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 sticky bottom-0 left-0 right-0 z-50"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="relative max-w-4xl mx-auto flex flex-col gap-2">
                {/* Code Helper Toggle */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowCodeHelper(!showCodeHelper)}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                    >
                        <Lightbulb className="h-3 w-3" />
                        Code Templates
                    </button>
                    
                    <button
                        onClick={() => setIsCodeGuideOpen(true)}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                    >
                        <Code2 className="h-3 w-3" />
                        Code Formatting Guide
                    </button>

                    {input.trim() && (
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                        >
                            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showPreview ? 'Hide Preview' : 'Preview'}
                        </button>
                    )}
                </div>

                {/* Code Helper Panel */}
                {showCodeHelper && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-2">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Quick Templates</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                            {CODE_SUGGESTIONS.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => insertTemplate(suggestion.template)}
                                    className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                                >
                                    <div className="font-medium text-blue-400">{suggestion.label}</div>
                                    <div className="text-gray-400 text-xs">{suggestion.description}</div>
                                </button>
                            ))}
                        </div>
                        
                        <div className="border-t border-gray-700 pt-2">
                            <div className="text-xs text-gray-400 mb-2">Quick Code Block:</div>
                            <div className="flex flex-wrap gap-1">
                                <button
                                    onClick={() => insertCodeBlock('code')}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                >
                                    ```code```
                                </button>
                                {COMMON_LANGUAGES.slice(0, 6).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => insertCodeBlock(lang)}
                                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Input Area */}
                <div className="flex gap-1 sm:gap-2 items-end">
                    <div className="flex-1 relative">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => insertCodeBlock()}
                                className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                                title="Insert code block (```code```)"
                            >
                                <Code2 className="h-3 w-3" />
                                Code
                            </button>
                            
                            {hasCodeBlock && (
                                <div className="flex items-center gap-1 text-xs text-green-400">
                                    <Code2 className="h-3 w-3" />
                                    Code block detected
                                </div>
                            )}
                        </div>

                        {/* Text Input */}
                        {showPreview && input.trim() ? (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 min-h-[100px] max-h-[300px] overflow-y-auto">
                                <div className="text-xs text-gray-400 mb-2">Preview:</div>
                                <div className="text-white whitespace-pre-wrap text-sm">
                                    {input.split('```').map((part, index) => {
                                        if (index % 2 === 1) {
                                            // This is inside a code block
                                            const lines = part.split('\n');
                                            const language = lines[0] || 'code';
                                            const code = lines.slice(1).join('\n');
                                            return (
                                                <div key={index} className="bg-gray-900 border border-gray-600 rounded p-2 my-2">
                                                    <div className="text-xs text-blue-400 mb-1">{language}</div>
                                                    <pre className="text-gray-300 text-xs overflow-x-auto">{code}</pre>
                                                </div>
                                            );
                                        }
                                        return <span key={index}>{part}</span>;
                                    })}
                                </div>
                            </div>
                        ) : (
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isLoading ? "MorroChat is thinking..." : `Message MorroChat...\n\nTip: Use \`\`\`code\`\`\` for code blocks or click the Code button above`}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none min-h-[100px] max-h-[300px]"
                                disabled={isLoading}
                                style={{ 
                                    WebkitTouchCallout: 'none', 
                                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                                }}
                            />
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <FileUpload
                            onSelect={setSelectedFile}
                            selectedFile={selectedFile}
                            onRemove={() => setSelectedFile(null)}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || (!input.trim() && !selectedFile)}
                            className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                            title="Send message (Enter)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="text-xs text-center text-gray-500 mt-2 flex items-center justify-center gap-4">
                <span>MorroChat can make mistakes. Consider checking important information.</span>
                <span className="text-gray-600">•</span>
                <span className="text-blue-400">Shift+Enter for new line</span>
            </div>
        </div>
    );
});

EnhancedChatInput.displayName = 'EnhancedChatInput';
