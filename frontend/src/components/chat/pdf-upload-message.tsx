import React from 'react';
import { HiOutlineDocumentText, HiOutlineDownload, HiOutlineEye } from 'react-icons/hi';
import { formatFileSize } from '../../utils/pdf-utils';

interface PdfUploadMessageProps {
  fileName: string;
  fileSize?: string | number;
  uploadDate?: Date;
  className?: string;
  showActions?: boolean;
}

export const PdfUploadMessage: React.FC<PdfUploadMessageProps> = ({ 
  fileName, 
  fileSize,
  uploadDate,
  className = '',
  showActions = false
}) => {
  // Extract file name without extension for cleaner display
  const displayName = fileName.replace(/\.[^/.]+$/, "");
  const fileExtension = fileName.split('.').pop()?.toUpperCase() || 'PDF';

  const getFormattedFileSize = (size?: string | number) => {
    if (!size) return null;
    
    if (typeof size === 'string') {
      // If size is already formatted, return as is
      if (size.includes('MB') || size.includes('KB') || size.includes('GB')) {
        return size;
      }
      // Try to parse as number
      const parsed = parseInt(size);
      if (!isNaN(parsed)) {
        return formatFileSize(parsed);
      }
      return null;
    }
    
    if (typeof size === 'number') {
      return formatFileSize(size);
    }
    
    return null;
  };

  const formatUploadDate = (date?: Date) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formattedSize = getFormattedFileSize(fileSize);
  const formattedDate = formatUploadDate(uploadDate);

  return (
    <div className={`bg-blue-600 text-white rounded-2xl px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        {/* PDF Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center shadow-lg">
          <HiOutlineDocumentText className="w-6 h-6 text-white" />
        </div>
        
        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white truncate">
              {displayName}
            </h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-700 text-blue-100 shadow-sm">
              {fileExtension}
            </span>
          </div>
          
          {(formattedSize || formattedDate) && (
            <div className="flex items-center gap-3 text-xs text-blue-200 mb-1">
              {formattedSize && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-blue-300 rounded-full"></span>
                  {formattedSize}
                </span>
              )}
              {formattedDate && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-blue-300 rounded-full"></span>
                  {formattedDate}
                </span>
              )}
            </div>
          )}
          
          <p className="text-xs text-blue-100 flex items-center gap-1">
            <span className="text-green-300">✓</span>
            Document uploaded and ready for analysis
          </p>
        </div>

        {/* Action Buttons (optional) */}
        {showActions && (
          <div className="flex-shrink-0 flex gap-1">
            <button 
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-700 rounded-lg transition-colors"
              title="View document"
            >
              <HiOutlineEye className="w-4 h-4" />
            </button>
            <button 
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-700 rounded-lg transition-colors"
              title="Download document"
            >
              <HiOutlineDownload className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
