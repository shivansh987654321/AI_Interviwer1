// =================================================================
// 1. LOAD ENVIRONMENT VARIABLES (MUST BE FIRST)
// =================================================================
import dotenv from 'dotenv';
dotenv.config(); 

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { initializeInterviewSocket } from './sockets/interview.socket';

// =================================================================
// 2. DEBUG CONFIGURATION
// =================================================================
console.log("------------------------------------------------");
console.log("🚀 STARTING SERVER...");
console.log("🔑 API KEY STATUS:", process.env.OPENAI_API_KEY ? "✅ LOADED" : "❌ MISSING (Check .env)");
console.log("------------------------------------------------");

const PORT = Number(process.env.PORT) || 5001;

// =================================================================
// 3. CREATE HTTP & SOCKET SERVER
// =================================================================
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    // FIX: Allow all localhost variations
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"]
      : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  // FIX: Explicitly allow polling first to prevent handshake errors
  transports: ['polling', 'websocket'] 
});

// Initialize Socket Logic
initializeInterviewSocket(io);

// =================================================================
// 4. START SERVER (Bind to 0.0.0.0 for stability)
// =================================================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Health Check: http://localhost:${PORT}/health`);
  console.log(`✅ API Base: http://localhost:${PORT}/api/interview`);
});

// Error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});