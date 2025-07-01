import React from 'react';
import { Clock, MemoryStick, Activity } from 'lucide-react';

interface ComplexityBadgeProps {
  type: 'time' | 'space' | 'overall';
  complexity: string;
  description?: string;
}

export const ComplexityBadge: React.FC<ComplexityBadgeProps> = ({ 
  type, 
  complexity, 
  description 
}) => {
  const getConfig = () => {
    switch (type) {
      case 'time':
        return {
          icon: Clock,
          label: 'Time',
          colors: 'bg-blue-900/40 border-blue-500/60 text-blue-300'
        };
      case 'space':
        return {
          icon: MemoryStick,
          label: 'Space',
          colors: 'bg-purple-900/40 border-purple-500/60 text-purple-300'
        };
      case 'overall':
        return {
          icon: Activity,
          label: 'Overall',
          colors: 'bg-green-900/40 border-green-500/60 text-green-300'
        };
      default:
        return {
          icon: Activity,
          label: 'Performance',
          colors: 'bg-gray-900/40 border-gray-500/60 text-gray-300'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  // Get complexity color based on complexity level
  const getComplexityColor = (comp: string) => {
    const lower = comp.toLowerCase();
    if (lower.includes('o(1)') || lower.includes('constant')) return 'text-green-400';
    if (lower.includes('o(log') || lower.includes('logarithmic')) return 'text-blue-400';
    if (lower.includes('o(n)') && !lower.includes('o(n²)') && !lower.includes('o(n*')) return 'text-yellow-400';
    if (lower.includes('o(n*m)') || lower.includes('o(n²)') || lower.includes('quadratic')) return 'text-orange-400';
    if (lower.includes('o(2^n)') || lower.includes('exponential')) return 'text-red-400';
    return 'text-gray-300';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${config.colors} text-sm`}>
      <IconComponent className="h-4 w-4" />
      <span className="font-medium">{config.label}:</span>
      <code className={`font-mono font-bold ${getComplexityColor(complexity)}`}>
        {complexity}
      </code>
      {description && (
        <span className="text-gray-400 text-xs ml-1">({description})</span>
      )}
    </div>
  );
};
