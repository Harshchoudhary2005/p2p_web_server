import { useState, useRef } from "react";
import { formatBytes } from "../utils/helpers";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function DropZone({ onFileSelected }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const validateAndSelect = (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Max size is 50MB (yours is ${formatBytes(file.size)}).`);
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSelect(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-colors
          ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-400"}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => validateAndSelect(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl">📁</div>
          <p className="text-gray-700 font-medium">Drag & drop a file here, or click to browse</p>
          <p className="text-sm text-gray-400">Maximum file size: 50 MB</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600 text-center font-medium">{error}</p>}
    </div>
  );
}