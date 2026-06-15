# P2P Web Share — Direct Browser-to-Browser File Transfer

A lightweight, decentralized file-sharing web app. Drop a file, get a unique share link, and send it directly to whoever opens that link — peer-to-peer over WebRTC. A minimal Node.js/Socket.IO signaling server only coordinates the initial handshake; it never reads, processes, or stores file data.

## Project Description

Traditional file-sharing services route every file through a central server, which costs bandwidth and storage and adds a privacy bottleneck. This project avoids that entirely: once two browsers connect, the file streams directly between them over a WebRTC data channel.

### Core MVP features implemented

- **Share Room Creation** — drag-and-drop or file-picker upload (50MB limit), generating a unique Room ID and shareable link.
- **Signaling Handshake** — Node.js/Express + Socket.IO server coordinates WebRTC offer/answer/ICE exchange between the two peers.
- **Direct P2P Transfer** — files are read in 16KB chunks via the `File.slice()` / `ArrayBuffer` API and sent over an `RTCDataChannel`, with backpressure handling via `bufferedAmount`.
- **Chunk Verification** — each chunk's SHA-256 hash is computed and sent as a header before the chunk; the receiver re-hashes on arrival and flags any mismatch as corruption.
- **Progress & Connection Status UI** — live transfer percentage, speed (MB/s), and connection state (idle/connecting/waiting/connected/disconnected/error) shown via dedicated status components.
- **Graceful Disconnect Handling** — peer disconnects, connection drops, and signaling errors are caught and surfaced to the user without crashing the app.
- **Auto-Download** — incoming chunks are reassembled into a `Blob` in memory and automatically downloaded once the transfer completes.

## Project Structure

```
p2p_web_server/
├── backend/                       # Signaling server (Express + Socket.IO)
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── frontend/                      # React app (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── DropZone.jsx       # File picker / drag-drop, size validation
│   │   │   ├── ShareLink.jsx      # Displays/copies the generated share link
│   │   │   └── TransferStatus.jsx # Progress bar, speed, status, errors
│   │   ├── hooks/
│   │   │   └── useWebRTC.js       # WebRTC connection, signaling, chunked transfer + hashing
│   │   ├── utils/
│   │   │   └── helpers.js         # Room ID generation, SHA-256 chunk hashing, byte formatting
│   │   ├── App.jsx                # Root component, sender/receiver flow
│   │   ├── index.css              # Tailwind base styles
│   │   └── main.jsx                # React entry point
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── .gitignore
└── README.md
```

## How It Works

1. **Sender** drops a file → a Room ID is generated → the frontend connects to the signaling server and joins that room → a share link (`?room=<id>`) is created.
2. **Receiver** opens the share link → joins the same room.
3. The signaling server relays WebRTC **offer/answer/ICE candidates** between the two peers (using public Google STUN servers for NAT traversal).
4. Once the `RTCDataChannel` opens, the sender streams `metadata` → `chunk-header` (with SHA-256 hash) → chunk binary data → `done`.
5. The receiver verifies each chunk's hash, reassembles the file in memory, and triggers an automatic download on completion.

## Setup & Running Locally

### 1. Backend (signaling server)

```bash
cd backend
npm install
npm run dev      # or: npm start
```

Runs on `http://localhost:3001` by default (configurable via `PORT` env var).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens the Vite dev server (default `http://localhost:5173`).

> **Note:** `useWebRTC.js` currently points `SIGNALING_SERVER_URL` to a deployed Render instance. For local development, change this constant to `http://localhost:3001` (or your local backend's address).

## Usage

1. Open the app and drop/select a file (max 50MB).
2. Copy the generated share link and send it to the other person.
3. When they open the link, a direct WebRTC connection is established.
4. Watch live progress and speed on both ends — the receiver's browser auto-downloads the file once the transfer completes and is verified.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Tailwind CSS, Vite |
| P2P Communication | WebRTC (RTCPeerConnection + RTCDataChannel) |
| Backend / Signaling | Node.js, Express.js, Socket.IO |
| Hosting | Vercel/Netlify (frontend), Render/Railway (backend) |

## Deployment Links

- **Live App (Frontend):** https://p2p-web-server.vercel.app/
- **Signaling Server (Backend):** https://p2p-web-server.onrender.com
- **Demo Video:**to be added

## Known Limitations / Possible Extensions

- No TURN server configured — transfers may fail on strict NATs/firewalls without a relay fallback.
- Files are held fully in browser memory (no OPFS/IndexedDB streaming), so the 50MB cap applies.
- One sender ↔ one receiver per room (no multi-peer mesh swarming).
- No zero-knowledge encryption layer or connection-churn auto-resume yet — both are listed as optional advanced extensions.
