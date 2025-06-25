import React, { useState } from 'react';
import { FileUpload } from './file-upload';

interface ChatInputProps {
    onSendMessage: (message: string, file?: File | null) => void;
    isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleSend = () => {
        if ((input.trim() || selectedFile) && !isLoading) {
            onSendMessage(input.trim(), selectedFile);
            setInput('');
            setSelectedFile(null);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div
            className="p-2 sm:p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 sticky bottom-0 left-0 right-0 z-50"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="relative max-w-4xl mx-auto flex flex-col gap-2">
                <div className="flex gap-1 sm:gap-2 items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isLoading ? "MorroChat is thinking..." : "Message MorroChat..."}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-full py-2 sm:py-3 pl-4 sm:pl-6 pr-12 sm:pr-16 text-xs sm:text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        disabled={isLoading}
                        inputMode="text"
                        autoComplete="off"
                        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                    />
                    <FileUpload
                        onSelect={setSelectedFile}
                        selectedFile={selectedFile}
                        onRemove={() => setSelectedFile(null)}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !selectedFile)}
                        className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ml-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </div>
            <p className="text-xs text-center text-gray-500 mt-2">
                MorroChat can make mistakes. Consider checking important information.
            </p>
        </div>
    );
};