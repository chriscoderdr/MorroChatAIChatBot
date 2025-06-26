import React from 'react';
import { Card } from '../ui/card';
import MorroLogo from '../../assets/morro-logo.svg';

interface EmptyStateProps {
  onSuggestionClick: (message: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestionClick }) => {
  const suggestionCards = [
    { title: "Plan a trip", description: "to the beaches of Montecristi" },
    { title: "Write a poem", description: "about the iconic El Morro" },
    { title: "Explain in simple terms", description: "what makes React so powerful" },
    { title: "Suggest a color palette", description: "inspired by a Caribbean sunset" },
  ];

  const handleCardClick = (card: { title: string; description: string }) => {
    const fullMessage = `${card.title} ${card.description}`;
    onSuggestionClick(fullMessage);
  };

  return (
    <div className="flex flex-col items-center flex-1 min-h-0 text-center p-4 sm:p-8 w-full overflow-y-auto">
       <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 p-2 flex items-center justify-center">
            <img src={MorroLogo} alt="MorroChat Large Logo" className="w-16 h-16"/>
        </div>
      <h1 className="text-4xl font-bold text-white mb-2">How can I help you today?</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-3xl">
        {suggestionCards.map((card, index) => (
          <Card 
            key={index} 
            className="text-left hover:bg-gray-700/80 transition-all cursor-pointer group"
            onClick={() => handleCardClick(card)}
          >
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="text-sm text-gray-400">{card.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};