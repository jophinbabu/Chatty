import { Server } from "socket.io";
import http from "http";
import https from "https";
import express from "express";
import selfsigned from "selfsigned";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
let server;

// Production: Use standard HTTP (Render handles SSL termination)
if (process.env.NODE_ENV === "production") {
  server = http.createServer(app);
} else {
  // Development: Generate self-signed SSL for local HTTPS
  const certPath = path.resolve("./certs");
  if (!fs.existsSync(certPath)) fs.mkdirSync(certPath, { recursive: true });

  let httpsOptions = {};
  const keyFile = path.join(certPath, "key.pem");
  const certFile = path.join(certPath, "cert.pem");

  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    httpsOptions = {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    };
  } else {
    console.log("Generating self-signed certificates...");
    // Note: await is inside top-level execution which works in modules, 
    // but strict checks might prefer async wrapper. Assuming ESM.
    const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], { days: 365 });
    fs.writeFileSync(keyFile, pems.private);
    fs.writeFileSync(certFile, pems.cert);
    httpsOptions = { key: pems.private, cert: pems.cert };
    console.log("Certificates generated.");
  }
  server = https.createServer(httpsOptions, app);
}

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL] : ["http://localhost:5173", "https://localhost:5173", "https://192.168.1.9:5173"],
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {}; // {userId: socketId}

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`Socket connected: ${socket.id}, UserID: ${userId}`);

  if (userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log("Updated userSocketMap:", Object.keys(userSocketMap));
  }

  // Send the list of online users to all clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // --- 📞 VIDEO CALLING EVENTS ---
  socket.on("callUser", (data) => {
    const receiverSocketId = getReceiverSocketId(data.userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callUser", {
        signal: data.signalData,
        from: data.from,
        name: data.name,
      });
    }
  });

  socket.on("answerCall", (data) => {
    const callerSocketId = getReceiverSocketId(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  socket.on("endCall", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callEnded", { reason: data.reason });
    }
  });
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // Send to specific user that their friend is typing
      io.to(receiverSocketId).emit("displayTyping", { senderId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("hideTyping", { senderId });
    }
  });

  // --- 🎨 WHITEBOARD EVENTS ---
  socket.on("whiteboard-draw", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("whiteboard-draw", data);
    }
  });

  socket.on("whiteboard-clear", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("whiteboard-clear", data);
    }
  });

  socket.on("whiteboard-open", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("whiteboard-open", data);
    }
  });

  // --- 🎮 GAME EVENTS ---
  socket.on("game-invite", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("game-invite", data);
    }
  });

  socket.on("game-move", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("game-move", data);
    }
  });

  socket.on("game-reset", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("game-reset", data);
    }
  });

  // --- 🎨 PICTIONARY EVENTS ---
  socket.on("pictionary-invite", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) io.to(receiverSocketId).emit("pictionary-invite", data);
  });

  socket.on("pictionary-start", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) io.to(receiverSocketId).emit("pictionary-start", data);
  });

  socket.on("pictionary-draw", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) io.to(receiverSocketId).emit("pictionary-draw", data);
  });

  socket.on("pictionary-guess", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) io.to(receiverSocketId).emit("pictionary-guess", data);
  });

  socket.on("pictionary-game-over", (data) => {
    const receiverSocketId = getReceiverSocketId(data.to);
    if (receiverSocketId) io.to(receiverSocketId).emit("pictionary-game-over", data);
  });
});

// Export app and server to be used in server.js
export { app, io, server };
