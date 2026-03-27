# 🤖 AI Interviewer — Mock Technical Interview Platform

> **Simulate real FAANG-style interviews with AI.** Voice round → DSA coding → automated report card. Built with Groq LLaMA, Whisper, Socket.IO, and Next.js.

[![MIT License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://typescriptlang.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?logo=socket.io&logoColor=black)](https://socket.io)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3-orange)](https://groq.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://mongodb.com)

---

## 🧠 What It Does

AI Interviewer conducts a **complete, end-to-end technical interview** in three automated phases:
```
Phase 1 — Verbal Round
  AI introduces itself → asks theory questions → listens via mic → responds with voice

Phase 2 — Coding Round
  AI generates 3 unique DSA problems → candidate codes in Monaco editor → AI evaluates in real-time

Phase 3 — Report Card
  AI scores communication + technical + problem solving → saves to MongoDB → viewable in history
```

No human needed. The entire flow is automated by AI.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎤 Voice Interview | Real-time STT via Groq Whisper + browser Web Speech API |
| 🤖 AI Interviewer | LLaMA 3.3 70B conducts full verbal round as "Alex" |
| 💻 Live Code Editor | Monaco Editor — JavaScript, Python, Java, C++ |
| 🧩 DSA Questions | 3 unique AI-generated problems per session, deduplicated |
| ✅ Code Evaluation | Score 0–100, verdict, detailed feedback, improvement tips |
| 📊 Report Card | Communication / Technical / Problem Solving breakdown |
| ⚡ Real-time | Socket.IO WebSocket — live AI ↔ candidate communication |
| 🔒 Auth | Clerk — sign up, sign in, protected routes, middleware |
| 📋 History | All past interviews saved per user in MongoDB |
| 🎯 Difficulty Levels | Easy (15 min) · Medium (30 min) · Hard (45 min) |
| 🎨 Glassmorphism UI | Frosted glass design with animated background orbs |
| 🧪 Mock Mode | `MOCK_AI=true` — full dev/test with zero API cost |

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 14 | React framework, file-based routing |
| TypeScript | Type safety across all components |
| Clerk | Authentication — sign up, sign in, middleware |
| Monaco Editor | VS Code-grade in-browser code editor |
| Socket.IO Client | Real-time WebSocket communication |
| Web Speech API | Browser-native TTS (free, no API needed) |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| TypeScript | Type-safe backend code |
| Socket.IO | WebSocket server for real-time events |
| Groq API | LLaMA 3.3 70B — questions, evaluation, verbal AI |
| Groq Whisper | Speech-to-text transcription (free) |
| MongoDB + Mongoose | Interview history and report persistence |

---

## 🏗 Architecture
```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│   Next.js 14 + Clerk Auth + Glassmorphism UI            │
│                                                         │
│   index.tsx            → Difficulty selection           │
│   interview/[id].tsx   → Verbal + Coding interview UI   │
│   report/[id].tsx      → Final report card              │
│   history.tsx          → All past interviews            │
│   VoiceAssistant.tsx   → Mic, STT, TTS, Socket events   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket (Socket.IO)
┌──────────────────────▼──────────────────────────────────┐
│                      BACKEND                            │
│   Express API + Socket.IO Server                        │
│                                                         │
│   POST /api/interview/create    → Generate 3 questions  │
│   POST /api/interview/submit    → Evaluate code         │
│   POST /api/interview/stt       → Groq Whisper STT      │
│   POST /api/interview/tts       → Empty (browser TTS)   │
│   GET  /api/interview/report    → Fetch from MongoDB    │
│   GET  /api/interview/history   → All sessions per user │
│                                                         │
│   Socket Events:                                        │
│   start_voice_interview → Initialize AI session         │
│   user_speak            → Process candidate speech      │
│   submit_code_result    → Store coding result           │
│   end_interview         → Generate + save final report  │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────▼────────────────┐
          │       Groq API (FREE)       │
          │  LLaMA 3.3 70B  — LLM      │
          │  Whisper Large v3 — STT     │
          └─────────────────────────────┘
                       │
          ┌────────────▼────────────────┐
          │      MongoDB Atlas          │
          │  Interview sessions         │
          │  Report cards + history     │
          └─────────────────────────────┘
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/shivansh987654321/AI_Interviwer1.git
cd AI_Interviwer1
```

### 2️⃣ Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:
```dotenv
# Groq API — FREE at https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# MongoDB — FREE at https://mongodb.com/cloud/atlas
# Leave empty to use file-based session storage instead
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-interview

# Server config
PORT=5001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Mock mode — set true to skip all API calls during development
MOCK_AI=false
```
```bash
npm run dev
# ✅ Backend runs at http://localhost:5001
```

### 3️⃣ Frontend Setup
```bash
cd ../frontend
npm install
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:
```dotenv
# Clerk Auth — FREE at https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:5001
```
```bash
npm run dev
# ✅ Frontend runs at http://localhost:3000
```

---

## 💰 API Cost — Completely FREE with Groq

| Service | Model | Cost |
|---|---|---|
| LLM — questions, evaluation, verbal AI | LLaMA 3.3 70B | **FREE** |
| Speech-to-Text | Whisper Large v3 | **FREE** |
| Text-to-Speech | Browser Web Speech API | **FREE** |
| **Total per interview** | | **$0.00** |

> Groq provides generous free tier limits — more than enough for development and testing.
> For production at scale, check [console.groq.com](https://console.groq.com) for rate limits.

### 🧪 Develop with zero cost
```bash
# In backend/.env
MOCK_AI=true
```

All AI responses become instant static mock data — no API calls, no waiting, no cost.

---

## 📁 Project Structure
```
AI_Interviwer1/
│
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── db.ts                  # MongoDB connection with caching
│   │   ├── models/
│   │   │   └── Interview.ts           # Mongoose schema
│   │   ├── routes/
│   │   │   └── interview.routes.ts    # All REST endpoints
│   │   ├── services/
│   │   │   ├── ai.service.ts          # Groq LLM + Whisper
│   │   │   ├── mock.ai.service.ts     # Mock responses for dev
│   │   │   ├── question.service.ts    # Question generation + dedup
│   │   │   └── report.service.ts      # Report generation + DB save
│   │   ├── sockets/
│   │   │   └── interview.socket.ts    # Socket.IO event handlers
│   │   ├── types/
│   │   │   └── interview.types.ts     # Shared TypeScript types
│   │   ├── app.ts                     # Express app setup
│   │   └── server.ts                  # Server entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── components/
│   │   ├── VoiceAssistant.tsx         # Mic, STT, TTS, Socket events
│   │   ├── AIAvatar.tsx               # Animated interviewer avatar
│   │   ├── CameraFeed.tsx             # Candidate camera monitor
│   │   ├── QuestionCard.tsx           # Problem display
│   │   ├── AnswerInput.tsx            # Text input fallback
│   │   └── ErrorBoundary.tsx          # Error handling wrapper
│   ├── pages/
│   │   ├── index.tsx                  # Home — difficulty selection
│   │   ├── interview/[sessionId].tsx  # Main interview UI
│   │   ├── report/[sessionId].tsx     # Report card
│   │   ├── history.tsx                # Past interviews
│   │   ├── sign-in/[[...index]].tsx   # Clerk sign in
│   │   └── sign-up/[[...index]].tsx   # Clerk sign up
│   ├── styles/
│   │   └── globals.css
│   ├── middleware.ts                  # Clerk route protection
│   ├── .env.local.example
│   └── package.json
│
├── .gitignore
├── ARCHITECTURE.md
├── SETUP.md
└── README.md
```

---

## 🔄 Interview Flow
```
User selects difficulty
        ↓
POST /api/interview/create
        ↓
3 unique DSA questions generated in parallel (Groq LLaMA)
        ↓
Socket: start_voice_interview
        ↓
┌─────────────────────────────┐
│      VERBAL ROUND           │
│  AI speaks → user answers   │
│  Mic → Groq Whisper → text  │
│  text → LLaMA → AI response │
│  browser speechSynthesis    │
│  repeat 2-3 turns           │
│  action: START_CODING       │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│      CODING ROUND           │
│  Q1 → submit → evaluate     │
│  score ≥ 60 → next question │
│  Q2 → Q3 → all completed    │
└─────────────────────────────┘
        ↓
Socket: end_interview
        ↓
Final report generated (LLaMA)
        ↓
Saved to MongoDB
        ↓
Report card displayed
```

---

## 🚀 Roadmap

- [ ] Docker deployment support
- [ ] Video recording of interview sessions
- [ ] Go and Rust language support
- [ ] Auto difficulty adjustment based on performance
- [ ] Leaderboard across users
- [ ] Resume upload and personalized questions
- [ ] Mobile app (React Native)

---

## 👨‍💻 Author

**Shivansh Agrawal**
B.Tech CSE | AI & Full Stack Developer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/shivansh5894/)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black?logo=github)](https://github.com/shivansh987654321)

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

<p align="center">
  Built with ❤️ by Shivansh Agrawal
</p>
