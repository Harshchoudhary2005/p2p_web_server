import { formatBytes, formatSpeed } from "../utils/helpers";

export default function TransferStatus({ status, progress, speed, fileName, fileSize, errorMessage, complete }) {
  const statusConfig = {
    idle: { label: "Idle", color: "bg-gray-300", text: "text-gray-600" },
    waiting: { label: "Waiting for peer to join…", color: "bg-yellow-400", text: "text-yellow-700" },
    connecting: { label: "Connecting to peer…", color: "bg-blue-400", text: "text-blue-700" },
    connected: { label: "Connected", color: "bg-green-500", text: "text-green-700" },
    disconnected: { label: "Disconnected", color: "bg-red-400", text: "text-red-700" },
    error: { label: "Error", color: "bg-red-500", text: "text-red-700" },
  };

  const current = statusConfig[status] || statusConfig.idle;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block w-3 h-3 rounded-full ${current.color}`} />
        <span className={`text-sm font-medium ${current.text}`}>{current.label}</span>
      </div>

      {fileName && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
          {fileSize != null && <p className="text-xs text-gray-400">{formatBytes(fileSize)}</p>}
        </div>
      )}

      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{progress}%</span>
        {speed > 0 && !complete && <span>{formatSpeed(speed)}</span>}
        {complete && <span className="text-green-600 font-medium">Done ✅</span>}
      </div>

      {errorMessage && <p className="mt-3 text-sm text-red-600 text-center">{errorMessage}</p>}
    </div>
  );
}