import React from 'react';
import { HiOutlineDocumentText, HiOutlineRefresh } from 'react-icons/hi';

interface FileUploadBubbleProps {
  fileName: string;
  status: 'uploading' | 'failed' | 'retrying' | 'success';
  onRetry?: () => void;
  errorMessage?: string;
  progress?: number;
}

export const FileUploadBubble: React.FC<FileUploadBubbleProps> = ({ fileName, status, onRetry, errorMessage, progress }) => {
  let statusContent = null;
  let bubbleClasses = 'bg-blue-900/80 border border-blue-700 text-blue-200';

  if (status === 'uploading') {
    statusContent = (
      <>
        <span className="ml-2 text-xs text-blue-300 animate-pulse">Uploading...</span>
        {typeof progress === 'number' && (
          <div className="w-32 h-2 bg-blue-950/40 rounded-full overflow-hidden ml-4">
            <div
              className="h-2 bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </>
    );
  } else if (status === 'failed') {
    bubbleClasses = 'bg-red-900/80 border border-red-700 text-red-200';
    statusContent = (
      <>
        <span className="ml-2 text-xs text-red-300">Upload failed</span>
        {errorMessage && <span className="ml-2 text-xs text-red-400">{errorMessage}</span>}
        {onRetry && (
          <button onClick={onRetry} className="ml-3 flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors">
            <HiOutlineRefresh className="w-4 h-4" /> Retry
          </button>
        )}
      </>
    );
  } else if (status === 'retrying') {
    bubbleClasses = 'bg-yellow-900/80 border border-yellow-700 text-yellow-200';
    statusContent = <span className="ml-2 text-xs text-yellow-300 animate-pulse">Retrying...</span>;
  } else if (status === 'success') {
    bubbleClasses = 'bg-green-900/80 border border-green-700 text-green-200';
    statusContent = <span className="ml-2 text-xs text-green-300">Uploaded!</span>;
  }

  return (
    <div className={`max-w-xl px-4 py-3 rounded-2xl flex items-center gap-2 ${bubbleClasses}`}>
      <HiOutlineDocumentText className="w-6 h-6" />
      <span className="font-medium text-sm truncate max-w-xs">{fileName}</span>
      {statusContent}
    </div>
  );
};
