'use client';
import ReactMarkdown from 'react-markdown';

export function TextBlock({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 dark:prose-invert">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
