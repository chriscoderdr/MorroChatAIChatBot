export interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

export function parseMessageContent(message: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(message)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = message.slice(lastIndex, match.index).trim();
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
  if (lastIndex < message.length) {
    const remainingText = message.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({
        type: 'text',
        content: remainingText
      });
    }
  }

  // If no code blocks were found, return the entire message as text
  if (parts.length === 0 && message.trim()) {
    parts.push({
      type: 'text',
      content: message.trim()
    });
  }

  return parts;
}

export function hasCodeBlocks(message: string): boolean {
  return /```[\s\S]*?```/.test(message);
}
