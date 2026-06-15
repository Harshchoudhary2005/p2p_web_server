import { useState } from "react";

export default function ShareLink({ link }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
      <p className="text-xs text-indigo-500 font-medium mb-1">Share this link with the receiver:</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={link}
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 truncate"
          onClick={(e) => e.target.select()}
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors whitespace-nowrap"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}