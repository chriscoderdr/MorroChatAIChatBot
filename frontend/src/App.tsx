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
}

function App() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const chatMutation = useChatMutation();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);


  const handleSendMessage = (message: string) => {
    setMessages(prevMessages => [...prevMessages, { text: message, isUser: true }]);

    chatMutation.mutate({ message }, {
      onSuccess: (data) => {
        setMessages(prevMessages => [...prevMessages, { text: data.reply, isUser: false }]);
      },
      onError: (error) => {
        setMessages(prevMessages => [...prevMessages, { text: `Error: ${error.message}`, isUser: false }]);
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
                  <ChatMessage key={index} message={msg} />
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