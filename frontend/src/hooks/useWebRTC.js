import { useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { hashChunk } from "../utils/helpers";

const SIGNALING_SERVER_URL = "https://p2p-web-server.onrender.com";
const CHUNK_SIZE = 16 * 1024;

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC() {
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [transferComplete, setTransferComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [incomingFileInfo, setIncomingFileInfo] = useState(null);

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const fileRef = useRef(null);
  const roomIdRef = useRef(null);
  const remotePeerIdRef = useRef(null);

  const receivedChunksRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const pendingHashRef = useRef(null);

  const lastUpdateRef = useRef({ time: Date.now(), bytes: 0 });
  const incomingFileInfoRef = useRef(null);

  const updateProgressStats = (bytesSoFar, totalBytes) => {
    const now = Date.now();
    const elapsed = (now - lastUpdateRef.current.time) / 1000;
    if (elapsed > 0.2) {
      const bytesDelta = bytesSoFar - lastUpdateRef.current.bytes;
      setSpeed(bytesDelta / elapsed);
      lastUpdateRef.current = { time: now, bytes: bytesSoFar };
    }
    setProgress(Math.round((bytesSoFar / totalBytes) * 100));
  };

  const finalizeDownload = useCallback(() => {
    const info = incomingFileInfoRef.current;
    const blob = new Blob(receivedChunksRef.current, {
      type: info?.fileType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = info?.name || "downloaded-file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTransferComplete(true);
    setProgress(100);
  }, []);

  const handleIncomingMessage = useCallback(async (data) => {
    if (data instanceof ArrayBuffer) {
      const buffer = data;
      const actualHash = await hashChunk(buffer);
      if (pendingHashRef.current && actualHash !== pendingHashRef.current) {
        setErrorMessage("Data corruption detected during transfer.");
        return;
      }
      receivedChunksRef.current[chunkIndexRef.current] = buffer;
      receivedSizeRef.current += buffer.byteLength;
      chunkIndexRef.current += 1;

      const info = incomingFileInfoRef.current;
      if (info) updateProgressStats(receivedSizeRef.current, info.size);
      return;
    }

    const message = JSON.parse(data);
    switch (message.type) {
      case "metadata": {
        const info = { name: message.name, size: message.size, fileType: message.fileType };
        incomingFileInfoRef.current = info;
        setIncomingFileInfo(info);
        receivedChunksRef.current = new Array(message.totalChunks);
        receivedSizeRef.current = 0;
        chunkIndexRef.current = 0;
        lastUpdateRef.current = { time: Date.now(), bytes: 0 };
        break;
      }
      case "chunk-header":
        pendingHashRef.current = message.hash;
        break;
      case "done":
        finalizeDownload();
        break;
      default:
        break;
    }
  }, [finalizeDownload]);

  const setupDataChannel = useCallback((channel) => {
    channel.binaryType = "arraybuffer";
    dataChannelRef.current = channel;

    channel.onopen = () => setConnectionStatus("connected");
    channel.onclose = () => setConnectionStatus("disconnected");
    channel.onmessage = (event) => handleIncomingMessage(event.data);
  }, [handleIncomingMessage]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && remotePeerIdRef.current) {
        socketRef.current.emit("signal", {
          to: remotePeerIdRef.current,
          data: { candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setConnectionStatus("connected");
      else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setConnectionStatus("disconnected");
      }
    };

    pc.ondatachannel = (event) => setupDataChannel(event.channel);
    return pc;
  }, [setupDataChannel]);

  const createOffer = useCallback(async (peerId) => {
    const pc = createPeerConnection();
    const channel = pc.createDataChannel("fileTransfer");
    setupDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("signal", { to: peerId, data: offer });
    setConnectionStatus("connecting");
  }, [createPeerConnection, setupDataChannel]);

  const handleOffer = useCallback(async (offer, fromPeerId) => {
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: fromPeerId, data: answer });
    setConnectionStatus("connecting");
  }, [createPeerConnection]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = peerConnectionRef.current;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async (data) => {
    const pc = peerConnectionRef.current;
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    }
  }, []);

  const connectSocket = useCallback(() => {
    const socket = io(SIGNALING_SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => console.log("✅ Connected:", socket.id));

    socket.on("peer-joined", (peerId) => {
      remotePeerIdRef.current = peerId;
      createOffer(peerId);
    });

    socket.on("existing-peers", (peers) => {
      if (peers.length > 0) {
        remotePeerIdRef.current = peers[0];
        setConnectionStatus("connecting");
      }
    });

    socket.on("signal", async ({ from, data }) => {
      remotePeerIdRef.current = from;
      if (data.type === "offer") await handleOffer(data, from);
      else if (data.type === "answer") await handleAnswer(data);
      else if (data.candidate) await handleIceCandidate(data);
    });

    socket.on("peer-left", () => {
      setConnectionStatus("disconnected");
      setErrorMessage("The other user disconnected.");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("error");
      setErrorMessage("Could not reach signaling server. Is it running?");
    });
  }, [createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  const createRoom = useCallback((roomId, file) => {
    fileRef.current = file;
    roomIdRef.current = roomId;
    connectSocket();

    const trySend = () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-room", roomId);
        setConnectionStatus("waiting");
      } else {
        setTimeout(trySend, 100);
      }
    };
    trySend();
  }, [connectSocket]);

  const joinRoom = useCallback((roomId) => {
    roomIdRef.current = roomId;
    connectSocket();

    const trySend = () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-room", roomId);
        setConnectionStatus("connecting");
      } else {
        setTimeout(trySend, 100);
      }
    };
    trySend();
  }, [connectSocket]);

  const sendFile = useCallback(async () => {
    const file = fileRef.current;
    const channel = dataChannelRef.current;
    if (!file || !channel) return;
    if (channel.readyState !== "open") {
      await new Promise((resolve, reject) => {
        channel.onopen = () => resolve();
        channel.onerror = () => reject(new Error("Channel failed to open"));
        setTimeout(() => reject(new Error("Channel open timeout")), 10000);
      });
    }

    channel.send(JSON.stringify({
      type: "metadata",
      name: file.name,
      size: file.size,
      fileType: file.type,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    }));

    let offset = 0;
    let chunkIndex = 0;
    lastUpdateRef.current = { time: Date.now(), bytes: 0 };

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      const hash = await hashChunk(buffer);

      channel.send(JSON.stringify({ type: "chunk-header", index: chunkIndex, hash }));

      while (channel.bufferedAmount > 16 * CHUNK_SIZE) {
        await new Promise((r) => setTimeout(r, 10));
      }

      channel.send(buffer);
      offset += buffer.byteLength;
      chunkIndex += 1;
      updateProgressStats(offset, file.size);
    }

    channel.send(JSON.stringify({ type: "done" }));
    setTransferComplete(true);
  }, []);

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    socketRef.current?.disconnect();
  }, []);

  return {
    connectionStatus,
    progress,
    speed,
    transferComplete,
    errorMessage,
    incomingFileInfo,
    createRoom,
    joinRoom,
    sendFile,
    cleanup,
  };
}