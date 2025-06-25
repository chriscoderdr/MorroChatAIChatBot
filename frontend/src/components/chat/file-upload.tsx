import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadError: string | null;
  onRetry: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isUploading, uploadError, onRetry }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setFileTypeError('Only PDF files are allowed.');
        return;
      }
      setFileTypeError(null);
      onUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setFileTypeError('Only PDF files are allowed.');
        return;
      }
      setFileTypeError(null);
      onUpload(file);
    }
  };

  return (
    <div className="relative flex items-center">
      <label
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border border-dashed border-blue-400 bg-gray-800 hover:bg-blue-900/30 focus-within:ring-2 focus-within:ring-blue-500 ${dragActive ? 'ring-2 ring-blue-500 bg-blue-900/40' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
      >
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-4 4m4-4l4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
        </svg>
        <span className="text-blue-300 font-medium text-sm">Upload PDF</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>
      {isUploading && (
        <span className="ml-3 text-xs text-blue-400 animate-pulse">Uploading...</span>
      )}
      {fileTypeError && (
        <span className="ml-3 text-xs text-red-400">{fileTypeError}</span>
      )}
      {uploadError && !isUploading && (
        <button
          className="ml-3 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
          onClick={onRetry}
        >
          Upload failed. Retry?
        </button>
      )}
    </div>
  );
};
