import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onSelect: (file: File) => void;
  selectedFile: File | null;
  onRemove: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onSelect, selectedFile, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setFileTypeError('Only PDF files are allowed.');
        setTimeout(() => setFileTypeError(null), 3000);
        return;
      }
      setFileTypeError(null);
      onSelect(file);
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
        setTimeout(() => setFileTypeError(null), 3000);
        return;
      }
      setFileTypeError(null);
      onSelect(file);
    }
  };
  return (
    <div className="relative flex items-center">
      {!selectedFile && (
        <label
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border border-dashed border-blue-400 bg-gray-800 hover:bg-blue-900/30 focus-within:ring-2 focus-within:ring-blue-500 ${dragActive ? 'ring-2 ring-blue-500 bg-blue-900/40' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          tabIndex={0}
          aria-disabled={!!selectedFile}
          style={selectedFile ? { pointerEvents: 'none', opacity: 0.5 } : {}}
        >
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-4 4m4-4l4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
          </svg>
          <span className="text-blue-300 font-medium text-sm">Attach PDF</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={!!selectedFile}
          />
        </label>
      )}
      {selectedFile && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-700 via-blue-500 to-blue-400 border-2 border-blue-300 px-3 py-2 rounded-lg shadow-lg transition-all duration-300 scale-100 animate-[fadeIn_0.4s_ease]">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-4 4m4-4l4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
          </svg>
          <span className="text-white text-sm font-semibold max-w-[140px] truncate drop-shadow">{selectedFile.name}</span>
          <span className="ml-1 flex items-center justify-center bg-green-500 rounded-full w-5 h-5 transition-all duration-300 scale-100 animate-[popIn_0.3s_ease]">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <button
            type="button"
            className="ml-2 text-white hover:text-red-400 transition-colors text-lg font-bold"
            onClick={onRemove}
            aria-label="Remove attachment"
            title="Remove attachment"
          >
            &times;
          </button>
        </div>
      )}

      {fileTypeError && (
        <span className="ml-3 text-xs text-red-400 bg-gray-900/80 px-2 py-1 rounded transition-opacity duration-300">{fileTypeError}</span>
      )}
      {/* Drag overlay for accessibility */}
      {dragActive && (
        <div className="absolute inset-0 bg-blue-900/60 border-2 border-blue-400 border-dashed rounded-lg flex items-center justify-center pointer-events-none z-10">
          <span className="text-blue-200 font-semibold">Drop PDF to attach</span>
        </div>
      )}
    </div>
  );
};
