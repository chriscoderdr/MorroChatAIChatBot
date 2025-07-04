import React from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'loading';
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  let color = 'bg-gray-800 text-white';
  if (type === 'success') color = 'bg-green-600 text-white';
  if (type === 'error') color = 'bg-red-600 text-white';
  if (type === 'loading') color = 'bg-blue-600 text-white';

  return (
    <div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${color} animate-fadeIn`}
      role="alert"
      style={{ minWidth: 220 }}
    >
      {type === 'loading' && (
        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      )}
      <span>{message}</span>
      {onClose && (
        <button
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
          onClick={onClose}
          aria-label="Close notification"
        >
          ×
        </button>
      )}
    </div>
  );
};
