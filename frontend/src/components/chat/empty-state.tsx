import React from 'react';
import { Card } from '../ui/card';
import { Code2, Lightbulb, Search, Zap } from 'lucide-react';
import MorroLogo from '../../assets/morro-logo.svg';

interface EmptyStateProps {
  onSuggestionClick: (message: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestionClick }) => {
  const suggestionCards = [
    { 
      title: "Code Analysis", 
      description: "Upload or paste code for optimization review",
      icon: Code2,
      example: "```javascript\nfunction example() {\n  return 'Hello';\n}\n```"
    },
    { 
      title: "Performance Review", 
      description: "Analyze algorithm complexity and performance",
      icon: Zap,
      example: "Analyze the performance of:\n```code\n// Your algorithm here\n```"
    },
    { 
      title: "General Questions", 
      description: "Ask about programming concepts and best practices",
      icon: Lightbulb,
      example: "Explain the difference between REST and GraphQL"
    },
    { 
      title: "Debug Help", 
      description: "Get help fixing bugs and errors",
      icon: Search,
      example: "Debug this code:\n```python\n# Your buggy code here\n```"
    },
  ];

  const handleCardClick = (card: { title: string; description: string; icon: any; example: string }) => {
    onSuggestionClick(card.example);
  };

  return (
    <div className="flex flex-col items-center flex-1 min-h-0 text-center p-4 sm:p-8 w-full overflow-y-auto">
       <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 p-2 flex items-center justify-center">
            <img src={MorroLogo} alt="MorroChat Large Logo" className="w-16 h-16"/>
        </div>
      <h1 className="text-4xl font-bold text-white mb-2">How can I help you today?</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-3xl pb-32">
        {suggestionCards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <Card 
              key={index} 
              className="text-left hover:bg-gray-700/80 transition-all cursor-pointer group"
              onClick={() => handleCardClick(card)}
            >
              <div className="flex items-start gap-3">
                <div className="bg-blue-500/20 p-2 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                  <IconComponent className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{card.title}</h3>
                  <p className="text-sm text-gray-400">{card.description}</p>
                  <p className="text-xs text-blue-400 mt-1 font-mono">Click to try →</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};