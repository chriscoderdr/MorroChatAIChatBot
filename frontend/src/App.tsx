import { useState, useEffect, useRef } from 'react';
import { Header } from './components/layout/header';
import { Sidebar } from './components/layout/side-bar';
import { ChatMessage } from './components/chat/chat-message';
import { ChatInput } from './components/chat/chat-input';
import { EmptyState } from './components/chat/empty-state';
import { useChatMutation } from './hooks/useChatMutation';


interface IMessage {
  text: string;
  isUser: boolean;
  isError?: boolean;
  messageId?: string; // To track messages for retries
}

function App() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const chatMutation = useChatMutation();
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
              <EmptyState />
            ) : (
              <div className="space-y-6">
                {messages.map((msg, index) => (
                  <ChatMessage 
                    key={msg.messageId || index} 
                    message={msg} 
                    onRetry={msg.isError ? handleRetry : undefined}
                  />
                ))}
                {chatMutation.isPending && (
                  <ChatMessage message={{ text: '', isUser: false }} />
                )}
              </div>
            )}
          </div>
        </main>
        <ChatInput onSendMessage={handleSendMessage} isLoading={chatMutation.isPending} />
      </div>
    </div>
  );
}

export default App;