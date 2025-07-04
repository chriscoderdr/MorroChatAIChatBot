import React from 'react';
import { Lock } from 'lucide-react';

interface E2EEIndicatorProps {
  className?: string;
  tooltip?: string;
}

/**
 * End-to-End Encryption Indicator
 * Shows a lock icon and a label, with optional tooltip for accessibility.
 */
export const E2EEIndicator: React.FC<E2EEIndicatorProps> = ({ className = '', tooltip = 'End-to-end encrypted' }) => {
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-700/20 to-blue-700/20 border border-green-500/30 rounded-full text-xs font-medium text-green-300 ${className}`}
      title={tooltip}
      aria-label={tooltip}
      tabIndex={0}
    >
      <Lock className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
      <span className="ml-1">E2EE</span>
    </div>
  );
};
