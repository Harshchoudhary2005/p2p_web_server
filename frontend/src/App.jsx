import { useState, useEffect, useRef } from "react";
import DropZone from "./components/DropZone";
import ShareLink from "./components/ShareLink";
import TransferStatus from "./components/TransferStatus";
import { useWebRTC } from "./hooks/useWebRTC";
import { generateRoomId } from "./utils/helpers";

function App() {
  const {
    connectionStatus, progress, speed, transferComplete, errorMessage,
    incomingFileInfo, createRoom, joinRoom, sendFile, cleanup,
  } = useWebRTC();

  const [selectedFile, setSelectedFile] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [role, setRole] = useState(null);
  const hasSentRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRole("receiver");
      setRoomId(room);
      joinRoom(room);
    }
    return () => cleanup();
  }, [joinRoom, cleanup]);

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setRole("sender");
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    createRoom(newRoomId, file);
  };

  useEffect(() => {
    if (role === "sender" && connectionStatus === "connected" && !hasSentRef.current) {
      hasSentRef.current = true;
      sendFile();
    }
  }, [role, connectionStatus, sendFile]);

  const shareLink = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : "";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12 gap-6">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold text-gray-800">P2P Web Share</h1>
        <p className="text-gray-500 mt-1">Send files directly, browser-to-browser.</p>
      </div>

      {role === null && <DropZone onFileSelected={handleFileSelected} />}

      {role === "sender" && (
        <>
          {shareLink && <ShareLink link={shareLink} />}
          <TransferStatus
            status={connectionStatus} progress={progress} speed={speed}
            fileName={selectedFile?.name} fileSize={selectedFile?.size}
            errorMessage={errorMessage} complete={transferComplete}
          />
          {connectionStatus === "waiting" && (
            <p className="text-sm text-gray-400 text-center max-w-md">
              Open the link above in another browser/device to start the transfer.
            </p>
          )}
        </>
      )}

      {role === "receiver" && (
        <TransferStatus
          status={connectionStatus} progress={progress} speed={speed}
          fileName={incomingFileInfo?.name} fileSize={incomingFileInfo?.size}
          errorMessage={errorMessage} complete={transferComplete}
        />
      )}
    </div>
  );
}

export default App;