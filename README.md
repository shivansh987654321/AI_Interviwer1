# 🤖 AI Interviewer — Mock Technical Interview Platform

> **Simulate real FAANG-style interviews with AI.** Voice round → DSA coding round → automated report card.

[![MIT License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://typescriptlang.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?logo=socket.io&logoColor=black)](https://socket.io)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3%2070B-orange)](https://groq.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://mongodb.com)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://frontend-sage-ten-w3gyl2wexq.vercel.app)
[![Deployed on Render](https://img.shields.io/badge/Backend-Render-blue?logo=render)](https://ai-interviwer1.onrender.com)

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| 🌍 Frontend | [frontend-sage-ten-w3gyl2wexq.vercel.app](https://frontend-sage-ten-w3gyl2wexq.vercel.app) |
| ⚙️ Backend API | [ai-interviwer1.onrender.com](https://ai-interviwer1.onrender.com) |
| ❤️ Health Check | [ai-interviwer1.onrender.com/health](https://ai-interviwer1.onrender.com/health) |

> **Note:** Backend is on Render free tier — first request after idle takes ~50 seconds to wake up. Open the site 1 minute before a demo.

---

## 🧠 What It Does

AI Interviewer conducts a **complete, end-to-end technical interview** in three automated phases:

```
Phase 1 — Verbal Round
  AI introduces itself → asks DSA theory questions → listens via mic → responds with voice

Phase 2 — Coding Round
  Picks real LeetCode problems (NeetCode 150+) → candidate codes in Monaco editor
  → code executed in real sandboxed environment → instant pass/fail per test case

Phase 3 — Report Card
  AI scores communication + technical + problem solving → saved to MongoDB
```

No human needed. The entire flow is automated.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎤 Voice Interview | Real-time STT via Groq Whisper + browser Web Speech API |
| 🤖 AI Interviewer | LLaMA 3.3 70B conducts full verbal round |
| 💻 Live Code Editor | Monaco Editor (VS Code) — JavaScript, Python, Java, C++ |
| 🧩 Real DSA Questions | 120+ NeetCode/LeetCode problems organized by difficulty |
| ▶️ Run Code | Test against sample cases instantly (like LeetCode) |
| ✅ Real Code Execution | Server-side sandboxed execution — actual compile + run |
| 📊 Report Card | Communication / Technical / Problem Solving breakdown |
| ⚡ Real-time | Socket.IO WebSocket — live AI ↔ candidate communication |
| 🔒 Auth | Clerk — sign up, sign in, protected routes |
| 📋 History | All past interviews saved per user in MongoDB |
| 🎯 Difficulty Levels | Easy (45 min) · Medium (60 min) · Hard (120 min) |
| 🎨 Glassmorphism UI | Frosted glass design with animated background |
| 🧪 Mock Mode | `MOCK_AI=true` — full dev/test with zero API cost |

---

## 🛠 Tech Stack

### Frontend — Deployed on [Vercel](https://vercel.com)
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2 | React framework, file-based routing, SSG |
| TypeScript | 5.x | Type safety across all components |
| Clerk | 6.x | Authentication — sign up, sign in, middleware |
| Monaco Editor | 4.x | VS Code-grade in-browser code editor |
| Socket.IO Client | 4.x | Real-time WebSocket communication |
| Recharts | 3.x | Performance charts on dashboard |
| Web Speech API | Browser | TTS — free, no API needed |

### Backend — Deployed on [Render](https://render.com)
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 18+ | REST API server |
| TypeScript | 5.9 | Type-safe backend code |
| Socket.IO | 4.x | WebSocket server for real-time events |
| Groq API | — | LLaMA 3.3 70B — verbal AI, question gen, evaluation |
| Groq Whisper | Large v3 | Speech-to-text transcription |
| MongoDB + Mongoose | 9.x | Interview history and report persistence |
| child_process | Node built-in | Sandboxed code execution (node/python3/java/g++) |

### Question Bank
| Source | Count | Details |
|---|---|---|
| NeetCode 150+ | 120+ problems | Organized by Easy / Medium / Hard |
| Topics covered | 15+ | Arrays, Trees, Graphs, DP, Backtracking, etc. |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel)                          │
│   Next.js 14 + Clerk Auth + Glassmorphism UI            │
│                                                         │
│   /                    → Home + difficulty select       │
│   /select              → Interview type selection       │
│   /interview/[id]      → Verbal + Coding interview UI   │
│   /dashboard           → Stats + performance charts     │
│   /report/[id]         → Final report card              │
│   /history             → All past interviews            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS REST + WebSocket (Socket.IO)
┌──────────────────────▼──────────────────────────────────┐
│              BACKEND (Render)                           │
│   Express API + Socket.IO Server                        │
│                                                         │
│   POST /api/interview/create   → Pick question from bank│
│   POST /api/interview/run      → Execute code (sandbox) │
│   POST /api/interview/submit   → Evaluate + score       │
│   POST /api/interview/stt      → Groq Whisper STT       │
│   POST /api/interview/tts      → Browser TTS fallback   │
│   GET  /api/interview/report   → Fetch from MongoDB     │
│   GET  /api/interview/history  → All sessions per user  │
└──────────┬─────────────────────────────┬────────────────┘
           │                             │
    ┌──────▼──────┐               ┌──────▼──────┐
    │  Groq API   │               │   MongoDB   │
    │ LLaMA 3.3   │               │    Atlas    │
    │ Whisper v3  │               │  (history)  │
    └─────────────┘               └─────────────┘
           │
    ┌──────▼──────────────┐
    │  Code Execution     │
    │  node / python3     │
    │  java / g++         │
    │  (child_process)    │
    └─────────────────────┘
```

---

## ⚙️ Local Setup

### 1️⃣ Clone
```bash
git clone https://github.com/shivansh987654321/AI_Interviwer1.git
cd AI_Interviwer1
```

### 2️⃣ Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```dotenv
MOCK_AI=false
PORT=5001
FRONTEND_URL=http://localhost:3000
SESSION_TTL_HOURS=24

# Groq — FREE at https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# MongoDB Atlas — FREE at https://mongodb.com/cloud/atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai_interview

# Clerk — FREE at https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

```bash
npm run dev   # runs at http://localhost:5001
```

### 3️⃣ Frontend
```bash
cd ../frontend
npm install
```

Create `frontend/.env.local`:
```dotenv
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

```bash
npm run dev   # runs at http://localhost:3000
```

### 4️⃣ Mock Mode (zero API cost)
```dotenv
# backend/.env
MOCK_AI=true
```
All AI responses become instant static data — no API calls, no waiting, no cost.

---

## 💰 Cost — Completely FREE

| Service | Model | Cost |
|---|---|---|
| LLM — questions, evaluation, verbal AI | Groq LLaMA 3.3 70B | **FREE** |
| Speech-to-Text | Groq Whisper Large v3 | **FREE** |
| Text-to-Speech | Browser Web Speech API | **FREE** |
| Code Execution | Server child_process | **FREE** |
| Frontend Hosting | Vercel Hobby | **FREE** |
| Backend Hosting | Render Free | **FREE** |
| Database | MongoDB Atlas Free | **FREE** |
| Auth | Clerk Free (10k MAU) | **FREE** |
| **Total** | | **$0.00** |

---

## 📁 Project Structure

```
AI_Interviwer1/
├── backend/
│   └── src/
│       ├── data/
│       │   └── question-bank.ts       # 120+ NeetCode problems by difficulty
│       ├── lib/
│       │   └── db.ts                  # MongoDB connection
│       ├── middleware/
│       │   └── auth.middleware.ts     # Clerk JWT verification
│       ├── models/
│       │   └── Interview.ts           # Mongoose schema
│       ├── routes/
│       │   ├── interview.routes.ts    # All interview endpoints
│       │   └── user.routes.ts         # User profile endpoints
│       ├── services/
│       │   ├── ai.service.ts          # Groq LLM + Whisper + code execution
│       │   ├── mock.ai.service.ts     # Mock responses for dev
│       │   └── question.service.ts    # Question bank picker + dedup
│       ├── sockets/
│       │   └── interview.socket.ts    # Socket.IO event handlers
│       ├── types/
│       │   └── interview.types.ts     # Shared TypeScript interfaces
│       ├── app.ts                     # Express + CORS + Clerk setup
│       └── server.ts                  # HTTP + Socket.IO server
│
├── frontend/
│   ├── components/
│   │   ├── VoiceAssistant.tsx         # Mic, STT, TTS, Socket events
│   │   ├── AIAvatar.tsx               # Animated interviewer avatar
│   │   └── charts/                    # Dashboard performance charts
│   └── pages/
│       ├── index.tsx                  # Landing page
│       ├── select.tsx                 # Interview type selection
│       ├── interview/[sessionId].tsx  # Main interview UI
│       ├── dashboard.tsx              # User stats + charts
│       ├── report/[sessionId].tsx     # Report card
│       └── history.tsx                # Past interviews
│
├── render.yaml                        # Render deployment config
└── README.md
```

---

## 🔄 Interview Flow

```
User signs in (Clerk) → selects difficulty
           ↓
POST /api/interview/create
  → Picks 2 real problems from NeetCode bank
  → AI generates description + test cases + starter code
           ↓
Socket: start_voice_interview
           ↓
┌──────────────────────────┐
│      VERBAL ROUND        │
│  AI asks theory question │
│  User answers via mic    │
│  Groq Whisper → text     │
│  LLaMA → AI response     │
│  Browser speaks response │
│  Repeats 2-3 turns       │
│  → action: START_CODING  │
└──────────────────────────┘
           ↓
┌──────────────────────────┐
│      CODING ROUND        │
│  Monaco Editor + Run btn │
│  Real execution (sandbox)│
│  Pass/fail per test case │
│  Submit → score 0-100    │
│  Pass Q1 → move to Q2    │
└──────────────────────────┘
           ↓
Socket: end_interview
  → LLaMA generates final report
  → Saved to MongoDB Atlas
  → Report card displayed
```

---

## 👨‍💻 Author

**Shivansh Agrawal**
B.Tech CSE | AI & Full Stack Developer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/shivansh5894/)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black?logo=github)](https://github.com/shivansh987654321)

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<p align="center">Built with ❤️ by Shivansh Agrawal</p>
