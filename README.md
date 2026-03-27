# 🚀 AI Interviewer

AI-powered mock interview platform that simulates real technical interviews using AI-based question generation and automated code evaluation.

---

## 🔥 Features

- 🎤 **Voice interview** — Speech-to-text verbal round with animated AI avatar
- 💻 **Live coding** — Monaco editor with JS / Python / Java / C++ support
- 🤖 **AI-generated DSA questions** — Unique problems every session (GPT-4o)
- ✅ **Automated code evaluation** — Score, verdict, and improvement tips
- 📊 **Report card** — Overall score + communication / technical / problem-solving breakdown
- 🔄 **Real-time WebSocket** communication (Socket.IO)
- 🔒 **Authentication** — Clerk login, sign-up, sign-out
- 📋 **Interview history** — View all past interviews per user
- 🧪 **Mock/Test mode** — `MOCK_AI=true` skips all OpenAI calls (zero cost while developing)
- 🎯 **3 difficulty levels** — Easy (15 min), Medium (30 min), Hard (45 min)

---

## 💰 OpenAI API Cost Estimate

Each interview session makes approximately **5 GPT-4o calls**:

| Call | Typical tokens | Est. cost |
|------|---------------|-----------|
| 3 × DSA question generation | ~500 tokens each | ~$0.03 |
| 3–5 × verbal conversation turns | ~300 tokens each | ~$0.02 |
| 1 × code evaluation | ~800 tokens | ~$0.01 |
| 1 × final report generation | ~1 000 tokens | ~$0.01 |
| **Total per interview** | | **≈ $0.05–0.10** |

> **GPT-4o pricing (as of 2024):** $5 / 1M input tokens · $15 / 1M output tokens.
> 100 interviews ≈ **$5–10**. Always set a monthly spending limit in your OpenAI dashboard.

### 🧪 Test for free with MOCK_AI

Set `MOCK_AI=true` in `backend/.env` to get instant static responses without any API calls:

```bash
MOCK_AI=true   # Add this to backend/.env while developing
```

---

## 🛠 Tech Stack

### Frontend
- Next.js 14 · React 18 · TypeScript
- Clerk (authentication)
- Monaco Editor · Socket.IO client

### Backend
- Node.js · Express · TypeScript
- OpenAI GPT-4o
- Socket.IO · MongoDB (Mongoose)

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/shivansh987654321/AI_Interviwer1.git
cd AI_Interviwer1
```

---

### 2️⃣ Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

Then open `.env` and set your values — at minimum you must set `OPENAI_API_KEY`:

```
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URI=your_mongodb_uri_here  # Optional: database persistence
PORT=5001
FRONTEND_URL=http://localhost:3000
```

Run backend:

```bash
npm run dev
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file from the provided example:

```bash
cp .env.local.example .env.local
```

Then set your Clerk keys (get them free at [dashboard.clerk.com](https://dashboard.clerk.com)):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

```bash
npm run dev
```

Frontend runs at:

```
http://localhost:3000
```

---

## 🧩 Project Structure

```
AI_Interviwer1/
│
├── frontend/        # Next.js UI
├── backend/         # Express API & AI logic
├── screenshots/     # Project screenshots
└── README.md
```

---

## 🚀 Future Improvements

- Deploy using Docker
- Add video recording of interview sessions
- Support more coding languages (Go, Rust)
- Add difficulty auto-detection based on performance

---

## 👨‍💻 Author

Shivansh Agrawal  
B.Tech CSE | AI & Full Stack Enthusiast  

LinkedIn:  
https://www.linkedin.com/in/shivansh5894/
