import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import DocumentManager from './components/DocumentManager';

type Tab = 'documents' | 'chat';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('documents');

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans text-gray-900">
      {/* Top navigation bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <svg
            className="h-7 w-7 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className="text-base font-semibold tracking-tight">KAIST AI Agent</span>
        </div>
      </header>

      {/* Main content — two-panel layout on md+, tabbed on mobile */}
      <main className="flex flex-1 overflow-hidden">
        {/* ── Desktop: side-by-side panels ── */}
        <div className="hidden w-full md:flex">
          {/* Left panel — Document Manager */}
          <aside className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200 bg-white xl:w-96">
            <DocumentManager />
          </aside>

          {/* Right panel — Chat Interface */}
          <section className="flex flex-1 flex-col bg-gray-50">
            <ChatInterface />
          </section>
        </div>

        {/* ── Mobile: tabbed view ── */}
        <div className="flex w-full flex-col md:hidden">
          {/* Tab content */}
          <div className="flex-1 overflow-hidden bg-white">
            {activeTab === 'documents' ? <DocumentManager /> : <ChatInterface />}
          </div>

          {/* Tab bar at bottom */}
          <nav className="flex border-t border-gray-200 bg-white" aria-label="Main navigation">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
                ${activeTab === 'documents' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              aria-current={activeTab === 'documents' ? 'page' : undefined}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={activeTab === 'documents' ? 2 : 1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Documents
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
                ${activeTab === 'chat' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              aria-current={activeTab === 'chat' ? 'page' : undefined}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={activeTab === 'chat' ? 2 : 1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Chat
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}
