export function PdfUpload() {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Placeholder for API call
    console.log("Uploading file:", file.name);
    // const formData = new FormData();
    // formData.append("file", file);
    // await fetch("/api/upload", { method: "POST", body: formData });
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">1. Upload PDF</h2>
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-indigo-200 border-dashed rounded-lg cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-4 text-indigo-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
            </svg>
            <p className="mb-2 text-sm text-indigo-700 font-medium">Click to upload or drag and drop</p>
            <p className="text-xs text-indigo-500">PDF documents only</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
        </label>
      </div>
    </div>
  );
}
