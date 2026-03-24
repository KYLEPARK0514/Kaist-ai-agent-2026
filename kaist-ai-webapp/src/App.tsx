import React from 'react';

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      <div className="m-auto text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">KAIST AI Agent</h1>
        <p className="text-gray-600 text-lg">Phase 3 Web App SCaffold</p>
        <div className="mt-8 flex gap-4 justify-center">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 shadow">
            Upload PDF
          </button>
          <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 shadow">
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
