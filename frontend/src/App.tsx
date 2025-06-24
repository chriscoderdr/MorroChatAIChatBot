import React from 'react';
import { Header } from './components/layout/header';
import { Sidebar } from './components/layout/side-bar';
import { ChatMessage } from './components/chat/chat-message';
import { ChatInput } from './components/chat/chat-input';
import { EmptyState } from './components/chat/empty-state';
// To demonstrate a conversation, we'll use a boolean flag.
// In a real app, this would be based on your chat history state.
const hasMessages = true; 

const mockMessages = [
  { text: "Hello! Tell me about El Morro de Montecristi.", isUser: true },
  { text: "Of course! El Morro de Montecristi is a stunning limestone mesa that serves as a iconic landmark of the Dominican Republic, located in the province of Montecristi. It's known for its distinctive shape, resembling a dromedary, and its beautiful surrounding subtropical dry forest and mangrove swamps.", isUser: false },
  { text: "Wow, that sounds amazing! Can you suggest some activities to do there?", isUser: true },
  { text: "Absolutely! You could hike to the top for breathtaking views, explore the surrounding beaches like Playa El Morro, or take a boat tour through the mangroves of the Montecristi National Park. It's a paradise for nature lovers and photographers!", isUser: false },
];


function App() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {hasMessages ? (
               <div className="space-y-6">
                {mockMessages.map((msg, index) => (
                  <ChatMessage key={index} message={msg} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </main>
        <ChatInput />
      </div>
    </div>
  );
}

export default App;