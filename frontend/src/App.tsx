import { useState, useEffect, useRef } from 'react';
import { Header } from './components/layout/header';
import { Sidebar } from './components/layout/side-bar';
import { useNewChatMutation } from './hooks/useNewChatMutation';
import { ChatMessage } from './components/chat/chat-message';
import { ChatInput } from './components/chat/chat-input';
import { FileUploadBubble } from './components/chat/file-upload-bubble';
import { EmptyState } from './components/chat/empty-state';
import { ChatHistoryError } from './components/chat/chat-history-error';
import { useChatMutation } from './hooks/useChatMutation';
import { useUploadPdfMutation } from './hooks/useUploadPdfMutation';
import { useChatHistory } from './hooks/useChatHistory';


interface IMessage {
  text: string;
  isUser: boolean;
  isError?: boolean;
  messageId?: string; // To track messages for retries
}

function App() {
  const uploadPdfMutation = useUploadPdfMutation();
  const newChatMutation = useNewChatMutation();
  // Handler for starting a new chat session
  const handleNewChat = () => {
    setMessages([]); // Clear chat history
    setLastFailedMessage(null);
    setFileUpload(null);
    newChatMutation.mutate();
    // Optionally, reset other state if needed
  };
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

  // Real upload to backend with progress using react-query
  const uploadPdfWithMessage = (file: File, message: string) => {
    setFileUpload({ fileName: file.name, status: 'uploading', progress: 0, file, message });
    // If there are no messages and no message text, add a placeholder so the welcome screen disappears
    setMessages(prev => {
      if (prev.length === 0 && !message) {
        return [
          {
            text: `[PDF Uploaded] ${file.name}`,
            isUser: true,
            messageId: `file-${Date.now()}`
          }
        ];
      }
      return prev;
    });
    const minDisplayTime = 800; // ms
    const uploadStart = Date.now();
    uploadPdfMutation.mutate({
      file,
      message,
      onUploadProgress: (percent) => {
        setFileUpload(prev => prev ? { ...prev, progress: percent } : null);
      },
    }, {
      onSuccess: (data) => {
        const elapsed = Date.now() - uploadStart;
        const showSuccess = () => {
          setFileUpload({ fileName: file.name, status: 'success', progress: 100, file, message });
          setMessages(prev => [
            ...prev,
            // Only add the message if it wasn't already added above
            ...((prev.length === 0 || (prev.length === 1 && prev[0].text.startsWith('[PDF Uploaded]'))) && !message
              ? []
              : [{
                  text: `${message ? message + ' ' : ''}[PDF Uploaded] ${file.name}`,
                  isUser: true,
                  messageId: `file-${Date.now()}`
                }]),
            ...(
              data.answer
                ? [{
                    text: data.answer,
                    isUser: false,
                    messageId: `answer-${Date.now()}`
                  }]
                : []
            )
          ]);
          setTimeout(() => setFileUpload(null), 1200);
        };
        if (elapsed < minDisplayTime) {
          setTimeout(showSuccess, minDisplayTime - elapsed);
        } else {
          showSuccess();
        }
      },
      onError: (error: any) => {
        const elapsed = Date.now() - uploadStart;
        const showError = () => {
          setFileUpload({ fileName: file.name, status: 'failed', errorMessage: error?.message || 'Upload failed', progress: 100, file, message });
        };
        if (elapsed < minDisplayTime) {
          setTimeout(showError, minDisplayTime - elapsed);
        } else {
          showError();
        }
      },
    });
  };

  const handleRetryUpload = () => {
    if (fileUpload?.file) {
      setFileUpload({ ...fileUpload, status: 'retrying', errorMessage: undefined });
      setTimeout(() => {
        uploadPdfWithMessage(fileUpload.file!, fileUpload.message || '');
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
      handleSendMessage(lastFailedMessage);
    }
  };

  const handleSendMessage = (message: string, file?: File | null) => {
    // If sending a file, handle real upload with progress and feedback
    if (file) {
      uploadPdfWithMessage(file, message);
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
      <Sidebar onNewChat={handleNewChat} />
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
            ) : null}
            {/* Always show file upload bubble if uploading or feedback is needed */}
            {fileUpload && fileUpload.status && (
              <div className="space-y-6">
                <FileUploadBubble
                  fileName={fileUpload.fileName}
                  status={fileUpload.status}
                  errorMessage={fileUpload.errorMessage}
                  progress={fileUpload.progress}
                />
              </div>
            )}
            {/* Show chat messages if any */}
            {messages.length > 0 && (
              <div className="space-y-6">
                {messages.map((msg, index) => (
                  <ChatMessage 
                    key={msg.messageId || index} 
                    message={msg} 
                    onRetry={msg.isError ? handleRetry : undefined}
                  />
                ))}
                {(chatMutation.isPending || uploadPdfMutation.isPending) && (
                  <ChatMessage message={{ text: '', isUser: false }} />
                )}
              </div>
            )}
          </div>
        </main>
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={chatMutation.isPending || uploadPdfMutation.isPending}
        />
      </div>
    </div>
  );
}

export default App;