import React from 'react';
import { CheckCircle, Clock, Zap, Code2 } from 'lucide-react';

interface CodingResponseSummaryProps {
  analysisType: string;
  keyFindings: string[];
  recommendations: string[];
  complexity?: {
    current: string;
    improved?: string;
  };
}

export const CodingResponseSummary: React.FC<CodingResponseSummaryProps> = ({
  analysisType,
  keyFindings,
  recommendations,
  complexity
}) => {
  return (
    <div className="border border-gray-600/40 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4 my-4">
      <div className="flex items-center gap-2 mb-3">
        <Code2 className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-white">{analysisType} Summary</h3>
      </div>
      
      {/* Key Findings */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" />
          Key Findings
        </h4>
        <ul className="space-y-1">
          {keyFindings.map((finding, index) => (
            <li key={index} className="text-sm text-gray-200 flex items-start gap-2">
              <span className="text-yellow-400 mt-1">•</span>
              {finding}
            </li>
          ))}
        </ul>
      </div>

      {/* Complexity Analysis */}
      {complexity && (
        <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Complexity Analysis</h4>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-orange-900/40 border border-orange-500/40 text-orange-300 rounded text-xs">
              Current: {complexity.current}
            </span>
            {complexity.improved && (
              <span className="px-2 py-1 bg-green-900/40 border border-green-500/40 text-green-300 rounded text-xs">
                Optimized: {complexity.improved}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-green-400" />
          Optimization Recommendations
        </h4>
        <ul className="space-y-1">
          {recommendations.map((rec, index) => (
            <li key={index} className="text-sm text-gray-200 flex items-start gap-2">
              <CheckCircle className="h-3 w-3 text-green-400 mt-1 flex-shrink-0" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
