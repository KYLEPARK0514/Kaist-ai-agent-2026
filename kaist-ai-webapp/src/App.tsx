import { PdfUpload } from "./components/PdfUpload";
import { ChatInterface } from "./components/ChatInterface";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span className="text-indigo-600">⚡</span> KAIST AI WebApp
          </h1>
          <p className="text-gray-500 text-sm mt-1 ml-9">
            Upload your document and ask questions instantly
          </p>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8">
          <aside className="flex flex-col gap-6">
            <PdfUpload />
            <div className="bg-indigo-50 p-5 rounded-xl text-sm text-indigo-800 border border-indigo-100 shadow-sm">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                How it works
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-indigo-700/80">
                <li>Upload a PDF document.</li>
                <li>Wait for the backend to process it.</li>
                <li>Ask questions about its contents in the chat!</li>
              </ol>
            </div>
          </aside>
          
          <section className="h-[600px] flex flex-col">
            <ChatInterface />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;

