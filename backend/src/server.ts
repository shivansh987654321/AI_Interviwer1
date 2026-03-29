import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { initializeInterviewSocket } from './sockets/interview.socket';

console.log('------------------------------------------------');
console.log('🚀 STARTING SERVER...');
console.log('🔑 OPENAI_API_KEY:    ', process.env.OPENAI_API_KEY    ? '✅ LOADED' : '❌ NOT SET');
console.log('🔑 GROQ_API_KEY:      ', process.env.GROQ_API_KEY      ? '✅ LOADED' : '❌ NOT SET');
console.log('🎙️ ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ LOADED' : '⚠️  NOT SET (TTS fallback active)');

if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
  console.error('❌ No AI key found! Set OPENAI_API_KEY or GROQ_API_KEY in backend/.env');
}
console.log('🗄️ MONGODB_URI:', process.env.MONGODB_URI ? '✅ CONFIGURED' : '⚠️ NOT SET (file-based fallback)');
console.log('------------------------------------------------');

// Eager MongoDB connection — fail fast if DB is unreachable
import connectToDatabase from './lib/db';
if (process.env.MONGODB_URI) {
  connectToDatabase()
    .then(() => console.log('🗄️ MongoDB connected at startup'))
    .catch((err) => console.error('❌ MongoDB startup connection failed:', err.message));
}

const PORT = Number(process.env.PORT) || 5001;

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001']
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

initializeInterviewSocket(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Health Check: http://localhost:${PORT}/health`);
  console.log(`✅ API Base: http://localhost:${PORT}/api/interview`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});