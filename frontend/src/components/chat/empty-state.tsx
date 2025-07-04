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
      title: "Refactor Code",
      description: "Modernize your codebase with the latest syntax",
      icon: Code2,
      example: "Refactor this Javascript class to a functional component using hooks.\n```javascript\nclass Counter extends React.Component {\n  constructor(props) {\n    super(props);\n    this.state = { count: 0 };\n  }\n\n  render() {\n    return (\n      <div>\n        <p>You clicked {this.state.count} times</p>\n        <button onClick={() => this.setState({ count: this.state.count + 1 })}>\n          Click me\n        </button>\n      </div>\n    );\n  }\n}\n```"
    },
    {
      title: "Optimize Performance",
      description: "Analyze and improve algorithm efficiency",
      icon: Zap,
      example: "What is the Big O notation of this function, and can you optimize it?\n```javascript\nfunction findSum(arr, target) {\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = i + 1; j < arr.length; j++) {\n      if (arr[i] + arr[j] === target) {\n        return [arr[i], arr[j]];\n      }\n    }\n  }\n}\n```"
    },
    {
      title: "Architectural Advice",
      description: "Get insights on system design and best practices",
      icon: Lightbulb,
      example: "What are the pros and cons of using WebSockets vs. Server-Sent Events for real-time applications?"
    },
    {
      title: "Debug Async Code",
      description: "Find and fix tricky asynchronous bugs",
      icon: Search,
      example: "Why is this async function not returning the data correctly?\n```javascript\nasync function fetchData(url) {\n  const response = fetch(url);\n  const data = response.json();\n  return data;\n}\n```"
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
