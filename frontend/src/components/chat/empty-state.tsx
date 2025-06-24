import React from 'react';
import { Card } from '../ui/card';
import MorroLogo from '../../assets/morro-logo.svg';

export const EmptyState: React.FC = () => {
  const suggestionCards = [
    { title: "Plan a trip", description: "to the beaches of Montecristi" },
    { title: "Write a poem", description: "about the iconic El Morro" },
    { title: "Explain in simple terms", description: "what makes React so powerful" },
    { title: "Suggest a color palette", description: "inspired by a Caribbean sunset" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
       <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 p-2 flex items-center justify-center">
            <img src={MorroLogo} alt="MorroChat Large Logo" className="w-16 h-16"/>
        </div>
      <h1 className="text-4xl font-bold text-white mb-2">How can I help you today?</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-3xl">
        {suggestionCards.map((card, index) => (
          <Card key={index} className="text-left hover:bg-gray-700 transition-colors cursor-pointer">
            <h3 className="font-semibold text-white">{card.title}</h3>
            <p className="text-sm text-gray-400">{card.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};