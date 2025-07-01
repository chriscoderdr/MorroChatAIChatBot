export interface ParsedContent {
  type: 'text' | 'code' | 'pdf_upload';
  content: string;
  language?: string;
  fileName?: string;
  fileSize?: string;
  uploadDate?: Date;
}

export function parseMessageContent(message: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  
  // Check for PDF upload pattern first
  const pdfUploadRegex = /\[PDF Uploaded\]\s*([^\s]+)/g;
  
  let lastIndex = 0;
  let hasPdfUpload = false;
  
  // First, find and handle PDF uploads
  let pdfMatch;
  while ((pdfMatch = pdfUploadRegex.exec(message)) !== null) {
    hasPdfUpload = true;
    
    // Add text before the PDF upload
    if (pdfMatch.index > lastIndex) {
      const textContent = message.slice(lastIndex, pdfMatch.index).trim();
      if (textContent) {
        // Check if this text contains code blocks
        const textParts = parseTextForCodeBlocks(textContent);
        parts.push(...textParts);
      }
    }

    // Add the PDF upload
    const fileName = pdfMatch[1];
    parts.push({
      type: 'pdf_upload',
      content: pdfMatch[0],
      fileName: fileName
    });

    lastIndex = pdfMatch.index + pdfMatch[0].length;
  }

  // Add remaining text after the last PDF upload
  if (lastIndex < message.length) {
    const remainingText = message.slice(lastIndex).trim();
    if (remainingText) {
      const textParts = parseTextForCodeBlocks(remainingText);
      parts.push(...textParts);
    }
  }

  // If no PDF uploads were found, parse the entire message for code blocks
  if (!hasPdfUpload) {
    return parseTextForCodeBlocks(message);
  }

  return parts;
}

function parseTextForCodeBlocks(text: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // Add the code block
    const language = match[1] || 'code';
    const code = match[2].trim();
    if (code) {
      parts.push({
        type: 'code',
        content: code,
        language: language
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last code block
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({
        type: 'text',
        content: remainingText
      });
    }
  }

  // If no code blocks were found, return the entire text as text
  if (parts.length === 0 && text.trim()) {
    parts.push({
      type: 'text',
      content: text.trim()
    });
  }

  return parts;
}

export function hasCodeBlocks(message: string): boolean {
  return /```[\s\S]*?```/.test(message);
}

export function hasPdfUploads(message: string): boolean {
  return /\[PDF Uploaded\]\s*[^\s]+/.test(message);
}

export function isPdfUploadOnlyMessage(message: string): boolean {
  const trimmed = message.trim();
  return /^\[PDF Uploaded\]\s*[^\s]+$/.test(trimmed);
}
