import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.get("/", (req, res) => res.send("P2P Signaling Server is running ✅"));

const rooms = {};

io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    socket.to(roomId).emit("peer-joined", socket.id);

    const otherPeers = rooms[roomId].filter((id) => id !== socket.id);
    socket.emit("existing-peers", otherPeers);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const index = rooms[roomId].indexOf(socket.id);
      if (index !== -1) {
        rooms[roomId].splice(index, 1);
        socket.to(roomId).emit("peer-left", socket.id);
        if (rooms[roomId].length === 0) delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
});