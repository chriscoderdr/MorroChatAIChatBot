import { useState, useEffect, useRef } from 'react';
import { Header } from './components/layout/header';
import { Sidebar } from './components/layout/side-bar';
import { ChatMessage } from './components/chat/chat-message';
import { ChatInput } from './components/chat/chat-input';
import { FileUploadBubble } from './components/chat/file-upload-bubble';
import { EmptyState } from './components/chat/empty-state';
import { ChatHistoryError } from './components/chat/chat-history-error';
import { useChatMutation } from './hooks/useChatMutation';
import { useChatHistory } from './hooks/useChatHistory';
import type { ChatMessage as ChatMessageModel } from './models/chatMessage';

interface IMessage {
  text: string;
  isUser: boolean;
  isError?: boolean;
  messageId?: string; // To track messages for retries
}

function App() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [fileUpload, setFileUpload] = useState<{
    fileName: string;
    status: 'uploading' | 'failed' | 'retrying' | 'success' | null;
    errorMessage?: string;
    progress?: number;
    file?: File;
    message?: string;
  } | null>(null);
  const chatMutation = useChatMutation();
  const chatHistoryQuery = useChatHistory();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Upload simulation with progress
  const simulateFileUpload = (file: File, message: string) => {
    setFileUpload({ fileName: file.name, status: 'uploading', progress: 0, file, message });
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 10;
      if (progress >= 100) {
        clearInterval(interval);
        // Simulate random error
        if (Math.random() < 0.2) {
          setFileUpload({ fileName: file.name, status: 'failed', errorMessage: 'Network error', progress: 100, file, message });
        } else {
          setFileUpload({ fileName: file.name, status: 'success', progress: 100, file, message });
          setMessages(prev => [...prev, {
            text: `${message ? message + ' ' : ''}[PDF Uploaded] ${file.name}`,
            isUser: true,
            messageId: `file-${Date.now()}`
          }]);
          setTimeout(() => setFileUpload(null), 1200);
        }
      } else {
        setFileUpload(prev => prev ? { ...prev, progress, status: 'uploading' } : null);
      }
    }, 350);
  };

  const handleRetryUpload = () => {
    if (fileUpload?.file) {
      setFileUpload({ ...fileUpload, status: 'retrying', errorMessage: undefined });
      setTimeout(() => {
        simulateFileUpload(fileUpload.file!, fileUpload.message || '');
      }, 800);
    }
  };

  // Load chat history when component mounts
  useEffect(() => {
    if (chatHistoryQuery.data?.messages && chatHistoryQuery.data.hasMessages) {
      // Convert the new server message format to our local format
      const historyMessages = chatHistoryQuery.data.messages.map((msg, idx) => ({
        text: msg.data.content,
        isUser: msg.type === 'human',
        messageId: `history-${idx}`
      }));
      setMessages(historyMessages);
    }
  }, [chatHistoryQuery.data]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleRetry = () => {
    // If we have a last failed message, retry it
    if (lastFailedMessage) {
      handleSendMessage(lastFailedMessage, true);
    }
  };

  const handleSendMessage = (message: string, file?: File | null) => {
    // If sending a file, handle upload with progress and feedback
    if (file) {
      simulateFileUpload(file, message);
      return;
    }
    // Otherwise, send just the message
    const messageId = Date.now().toString();
    setMessages(prevMessages => [...prevMessages, { 
      text: message, 
      isUser: true,
      messageId
    }]);
    setLastFailedMessage(message);
    chatMutation.mutate({ message }, {
      onSuccess: (data) => {
        setLastFailedMessage(null);
        setMessages(prevMessages => [...prevMessages, { 
          text: data.reply, 
          isUser: false,
          messageId: `response-${messageId}`
        }]);
      },
      onError: (error) => {
        setMessages(prevMessages => [...prevMessages, { 
          text: `Error: ${error.message}`, 
          isUser: false, 
          isError: true,
          messageId: `error-${messageId}`
        }]);
      }
    });
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              chatHistoryQuery.isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : chatHistoryQuery.isError ? (
                <ChatHistoryError 
                  error={chatHistoryQuery.error} 
                  onRetry={() => chatHistoryQuery.refetch()} 
                />
              ) : (
                <EmptyState onSuggestionClick={handleSendMessage} />
              )
            ) : (
              <div className="space-y-6">
                {messages.map((msg, index) => (
                  <ChatMessage 
                    key={msg.messageId || index} 
                    message={msg} 
                    onRetry={msg.isError ? handleRetry : undefined}
                  />
                ))}
                {fileUpload && fileUpload.status && fileUpload.status !== 'success' && (
                  <FileUploadBubble
                    fileName={fileUpload.fileName}
                    status={fileUpload.status}
                    errorMessage={fileUpload.errorMessage}
                   progress={fileUpload.progress}
                  />
                )}
                {chatMutation.isPending && (
                  <ChatMessage message={{ text: '', isUser: false }} />
                )}
              </div>
            )}
          </div>
        </main>
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={chatMutation.isPending}
        />
      </div>
    </div>
  );
}

export default App;