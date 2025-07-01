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
import { isCodingRelated } from './utils/coding-detection';


interface IMessage {
  text: string;
  isUser: boolean;
  isError?: boolean;
  messageId?: string; // To track messages for retries
  isCodingRelated?: boolean; // To track if the message is coding-related
}

function App() {
  const uploadPdfMutation = useUploadPdfMutation();
  const newChatMutation = useNewChatMutation();
  // Handler for starting a new chat session
  const handleNewChat = () => {
    setMessages([]); // Clear chat history
    setLastFailedMessage(null);
    setLastMessageWasCodingRelated(false);
    setFileUpload(null);
    newChatMutation.mutate();
    // Optionally, reset other state if needed
  };
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [lastMessageWasCodingRelated, setLastMessageWasCodingRelated] = useState<boolean>(false);
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
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Real upload to backend with progress using react-query
  const uploadPdfWithMessage = (file: File, message: string) => {
    setFileUpload({ fileName: file.name, status: 'uploading', progress: 0, file, message });
    // If there are no messages and no message text, add a placeholder so the welcome screen disappears
    const isMessageCodingRelated = isCodingRelated(message);
    setLastMessageWasCodingRelated(isMessageCodingRelated);
    
    setMessages(prev => {
      if (prev.length === 0 && !message) {
        return [
          {
            text: `[PDF Uploaded] ${file.name}`,
            isUser: true,
            messageId: `file-${Date.now()}`,
            isCodingRelated: false
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
                messageId: `file-${Date.now()}`,
                isCodingRelated: isMessageCodingRelated
              }]),
            ...(
              data.answer
                ? [{
                  text: data.answer,
                  isUser: false,
                  messageId: `answer-${Date.now()}`,
                  isCodingRelated: isMessageCodingRelated
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
    if (!fileUpload?.file || fileUpload.status === 'retrying' || fileUpload.status === 'uploading') return;
    setFileUpload({
      ...fileUpload,
      status: 'retrying',
      errorMessage: undefined,
      progress: 0,
    });
    // Optionally scroll to bottom for UX
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
      uploadPdfWithMessage(fileUpload.file!, fileUpload.message || '');
    }, 800);
  };

  // Load chat history when component mounts
  useEffect(() => {
    if (chatHistoryQuery.data?.messages && chatHistoryQuery.data.hasMessages) {
      // Convert the new server message format to our local format
      const historyMessages = chatHistoryQuery.data.messages.map((msg, idx) => ({
        text: msg.data.content,
        isUser: msg.type === 'human',
        messageId: `history-${idx}`,
        isCodingRelated: msg.type === 'human' ? isCodingRelated(msg.data.content) : false
      }));
      setMessages(historyMessages);
    }
  }, [chatHistoryQuery.data]);


  // Scroll to the last message when messages change
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const isMessageCodingRelated = isCodingRelated(message);
    setLastMessageWasCodingRelated(isMessageCodingRelated);
    
    setMessages(prevMessages => [...prevMessages, {
      text: message,
      isUser: true,
      messageId,
      isCodingRelated: isMessageCodingRelated
    }]);
    setLastFailedMessage(message);
    chatMutation.mutate({ message }, {
      onSuccess: (data) => {
        setLastFailedMessage(null);
        setMessages(prevMessages => [...prevMessages, {
          text: data.reply,
          isUser: false,
          messageId: `response-${messageId}`,
          isCodingRelated: isMessageCodingRelated
        }]);
      },
      onError: (error) => {
        setMessages(prevMessages => [...prevMessages, {
          text: `Error: ${error.message}`,
          isUser: false,
          isError: true,
          messageId: `error-${messageId}`,
          isCodingRelated: isMessageCodingRelated
        }]);
      }
    });
  };

  return (
    <div
      className="flex fix-viewport bg-gradient-to-br from-gray-900 to-gray-800 text-white"
    >
      <Sidebar onNewChat={handleNewChat} />
      <div className="flex flex-col flex-1">
        <div
          className="sticky top-0 z-20 bg-gradient-to-br from-gray-900 to-gray-800"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <Header />
            {/* Mobile New Chat button, hidden on sm and up */}
            <button
              className="sm:hidden ml-2 px-3 py-1 rounded bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onClick={handleNewChat}
              aria-label="Start new chat"
            >
              New Chat
            </button>
          </div>
        </div>
        <main ref={chatContainerRef} className="flex-1 p-0 flex flex-col min-h-0">
          <div className={messages.length === 0 ? 'flex-1 w-full flex flex-col min-h-0' : 'max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0'}>
            {/* Show empty state or history loading/error if no messages */}
            {messages.length === 0 ? (
              chatHistoryQuery.isLoading ? (
                <div className="flex justify-center items-center h-64 w-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : chatHistoryQuery.isError ? (
                <ChatHistoryError
                  error={chatHistoryQuery.error}
                  onRetry={() => chatHistoryQuery.refetch()}
                />
              ) : (
                <div className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto">
                  <EmptyState onSuggestionClick={handleSendMessage} />
                </div>
              )
            ) : null}
            {/* Show chat messages if any */}
            {messages.length > 0 && (
              <>
                <div
                  className="flex flex-col overflow-y-auto gap-y-3 px-4 py-4"
                >
                  {messages.map((msg, index) => {
                    const isLast = index === messages.length - 1;
                    return (
                      <div key={msg.messageId || index} ref={isLast ? lastMessageRef : undefined}>
                        <ChatMessage
                          message={msg}
                          isCodingRelated={msg.isCodingRelated}
                          onRetry={msg.isError ? handleRetry : undefined}
                        />
                      </div>
                    );
                  })}
                  {(chatMutation.isPending || uploadPdfMutation.isPending) && (
                    <div ref={lastMessageRef}>
                      <ChatMessage 
                        message={{ text: '', isUser: false }} 
                        isCodingRelated={lastMessageWasCodingRelated}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
        {/* Always show file upload bubble if uploading or feedback is needed */}
        {fileUpload && fileUpload.status && (
          <div className="px-6 pb-2 max-w-5xl mx-auto w-full">
            <FileUploadBubble
              fileName={fileUpload.fileName}
              status={fileUpload.status}
              errorMessage={fileUpload.errorMessage}
              progress={fileUpload.progress}
              onRetry={handleRetryUpload}
            />
          </div>
        )}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={chatMutation.isPending || uploadPdfMutation.isPending}
        />
      </div>
    </div>
  );
}

export default App;