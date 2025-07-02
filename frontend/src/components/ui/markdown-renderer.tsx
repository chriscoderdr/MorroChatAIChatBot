import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from '../ui/code-block';

interface MarkdownRendererProps {
  content: string;
}

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-content break-words overflow-wrap-anywhere">
      <ReactMarkdown
        components={{
          // Custom code block renderer
          code: ({ className, children }: ComponentProps) => {
            const isInline = !className || !className.startsWith('language-');
            
            return !isInline ? (
              <CodeBlock className={className} inline={false}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            ) : (
              <CodeBlock inline={true}>
                {String(children)}
              </CodeBlock>
            );
          },
          
          // Custom paragraph renderer with enhanced spacing
          p: ({ children }: ComponentProps) => (
            <p className="mb-4 text-gray-200 leading-relaxed last:mb-2 text-sm sm:text-base break-words overflow-wrap-anywhere">
              {children}
            </p>
          ),
          
          // Enhanced heading renderers with better visual hierarchy
          h1: ({ children }: ComponentProps) => (
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 mt-6 first:mt-0 border-b border-gray-600/40 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }: ComponentProps) => (
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 mt-5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }: ComponentProps) => (
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 mt-4 first:mt-0">
              {children}
            </h3>
          ),
          
          // Enhanced list renderers with better styling
          ul: ({ children }: ComponentProps) => (
            <ul className="list-disc list-inside mb-4 text-gray-200 space-y-2 text-sm sm:text-base break-words overflow-wrap-anywhere">
              {children}
            </ul>
          ),
          ol: ({ children }: ComponentProps) => (
            <ol className="list-decimal list-inside mb-4 text-gray-200 space-y-2 text-sm sm:text-base break-words overflow-wrap-anywhere">
              {children}
            </ol>
          ),
          li: ({ children }: ComponentProps) => (
            <li className="ml-2 leading-relaxed break-words overflow-wrap-anywhere">
              {children}
            </li>
          ),
          
          // Enhanced blockquote for performance tips and insights
          blockquote: ({ children }: ComponentProps) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-3 my-4 bg-gradient-to-r from-blue-900/20 to-transparent rounded-r-lg break-words overflow-wrap-anywhere">
              <div className="text-gray-300 italic text-sm sm:text-base break-words overflow-wrap-anywhere">
                {children}
              </div>
            </blockquote>
          ),
          
          // Enhanced strong/bold renderer for key concepts
          strong: ({ children }: ComponentProps) => (
            <strong className="font-bold text-white bg-gray-700/30 px-1 py-0.5 rounded text-sm break-words overflow-wrap-anywhere">
              {children}
            </strong>
          ),
          
          // Custom emphasis/italic renderer
          em: ({ children }: ComponentProps) => (
            <em className="italic text-blue-300 break-words overflow-wrap-anywhere">
              {children}
            </em>
          ),

          // Custom table renderer for performance comparisons
          table: ({ children }: ComponentProps) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-600 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }: ComponentProps) => (
            <thead className="bg-gray-800">
              {children}
            </thead>
          ),
          tbody: ({ children }: ComponentProps) => (
            <tbody className="bg-gray-900/50">
              {children}
            </tbody>
          ),
          tr: ({ children }: ComponentProps) => (
            <tr className="border-b border-gray-700">
              {children}
            </tr>
          ),
          th: ({ children }: ComponentProps) => (
            <th className="px-4 py-2 text-left text-white font-semibold text-sm break-words overflow-wrap-anywhere">
              {children}
            </th>
          ),
          td: ({ children }: ComponentProps) => (
            <td className="px-4 py-2 text-gray-200 text-sm break-words overflow-wrap-anywhere">
              {children}
            </td>
          ),

          // Custom horizontal rule for section separation
          hr: () => (
            <hr className="my-6 border-t border-gray-600/40" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
