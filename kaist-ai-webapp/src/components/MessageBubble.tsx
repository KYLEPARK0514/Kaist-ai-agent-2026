import { useState } from 'react';
import type { MessageItem } from '../types/conversation';

interface Props {
  message: MessageItem;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const hasSources = message.sources.length > 0;
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
            ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100 rounded-bl-sm'
            }`}
        >
          {message.content}
        </div>

        {/* Sources toggle — only for assistant messages with sources */}
        {!isUser && hasSources && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setSourcesOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              aria-expanded={sourcesOpen}
            >
              <svg
                className={`h-3 w-3 transition-transform ${sourcesOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>

            {sourcesOpen && (
              <ul className="mt-1 space-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-100">
                {message.sources.map((src, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3 shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="truncate">{src.filename}</span>
                    <span className="shrink-0 text-gray-400">§{src.chunkIndex}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
