export interface PdfUploadInfo {
  fileName: string;
  fileSize?: number;
  uploadDate?: Date;
}

export function formatPdfUploadMessage(userMessage?: string, pdfInfo?: PdfUploadInfo): string {
  const fileName = pdfInfo?.fileName || 'document.pdf';
  
  if (userMessage && userMessage.trim()) {
    return `${userMessage.trim()}\n\n[PDF Uploaded] ${fileName}`;
  }
  
  return `[PDF Uploaded] ${fileName}`;
}

export function extractPdfFileName(uploadMessage: string): string | null {
  const match = uploadMessage.match(/\[PDF Uploaded\]\s*([^\s\n]+)/);
  return match ? match[1] : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
