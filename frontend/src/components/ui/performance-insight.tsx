import React from 'react';
import { Zap, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';

interface PerformanceInsightProps {
  type: 'optimization' | 'warning' | 'tip' | 'improvement';
  title: string;
  children: React.ReactNode;
}

export const PerformanceInsight: React.FC<PerformanceInsightProps> = ({ 
  type, 
  title, 
  children 
}) => {
  const getConfig = () => {
    switch (type) {
      case 'optimization':
        return {
          icon: Zap,
          colors: 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/40',
          iconColor: 'text-green-400',
          titleColor: 'text-green-300'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          colors: 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/40',
          iconColor: 'text-yellow-400',
          titleColor: 'text-yellow-300'
        };
      case 'tip':
        return {
          icon: Lightbulb,
          colors: 'bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-500/40',
          iconColor: 'text-blue-400',
          titleColor: 'text-blue-300'
        };
      case 'improvement':
        return {
          icon: TrendingUp,
          colors: 'bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-purple-500/40',
          iconColor: 'text-purple-400',
          titleColor: 'text-purple-300'
        };
      default:
        return {
          icon: Lightbulb,
          colors: 'bg-gradient-to-r from-gray-900/20 to-gray-800/20 border-gray-500/40',
          iconColor: 'text-gray-400',
          titleColor: 'text-gray-300'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return (
    <div className={`rounded-lg border p-4 my-4 ${config.colors}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.iconColor}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold mb-2 ${config.titleColor}`}>
            {title}
          </h4>
          <div className="text-gray-200 text-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
