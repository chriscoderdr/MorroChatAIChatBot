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
  } | null>(null);
  const chatMutation = useChatMutation();
  const chatHistoryQuery = useChatHistory();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // Simulate file upload (frontend only)
  const handleUploadFile = (file: File) => {
    setFileUpload({ fileName: file.name, status: 'uploading' });
    // Simulate upload delay and random error
    setTimeout(() => {
      if (Math.random() < 0.2) {
        setFileUpload({ fileName: file.name, status: 'failed', errorMessage: 'Network error' });
      } else {
        setFileUpload({ fileName: file.name, status: 'success' });
        // Add a message to the chat for the uploaded file
        setMessages(prev => [...prev, {
          text: `[PDF Uploaded] ${file.name}`,
          isUser: true,
          messageId: `file-${Date.now()}`
        }]);
        setTimeout(() => setFileUpload(null), 1200);
      }
    }, 1800);
  };

  const handleRetryUpload = () => {
    if (fileUpload?.fileName) {
      setFileUpload({ fileName: fileUpload.fileName, status: 'retrying' });
      setTimeout(() => {
        setFileUpload({ fileName: fileUpload.fileName, status: 'uploading' });
        setTimeout(() => {
          setFileUpload({ fileName: fileUpload.fileName, status: 'success' });
          setMessages(prev => [...prev, {
            text: `[PDF Uploaded] ${fileUpload.fileName}`,
            isUser: true,
            messageId: `file-${Date.now()}`
          }]);
          setTimeout(() => setFileUpload(null), 1200);
        }, 1500);
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

  const handleSendMessage = (message: string, isRetry = false) => {
    // If it's a retry, remove the error message first
    if (isRetry) {
      setMessages(prevMessages => prevMessages.filter(msg => !msg.isError));
    }
    
    // Add user message to the chat
    const messageId = Date.now().toString();
    setMessages(prevMessages => [...prevMessages, { 
      text: message, 
      isUser: true,
      messageId
    }]);

    // Save the message in case we need to retry
    setLastFailedMessage(message);

    // Send the message to the API
    chatMutation.mutate({ message }, {
      onSuccess: (data) => {
        // On success, clear the last failed message
        setLastFailedMessage(null);
        
        // Add the response to the chat
        setMessages(prevMessages => [...prevMessages, { 
          text: data.reply, 
          isUser: false,
          messageId: `response-${messageId}`
        }]);
      },
      onError: (error) => {
        // On error, add an error message to the chat
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
                    onRetry={fileUpload.status === 'failed' ? handleRetryUpload : undefined}
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
          onUploadFile={handleUploadFile}
          isUploading={!!fileUpload && (fileUpload.status === 'uploading' || fileUpload.status === 'retrying')}
          uploadError={fileUpload && fileUpload.status === 'failed' ? fileUpload.errorMessage || 'Upload failed' : null}
          onRetryUpload={handleRetryUpload}
        />
      </div>
    </div>
  );
}

export default App;