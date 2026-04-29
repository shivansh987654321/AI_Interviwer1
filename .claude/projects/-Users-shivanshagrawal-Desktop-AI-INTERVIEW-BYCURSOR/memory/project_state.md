---
name: AI Interview Platform State
description: Stack, running config, and bugs fixed in the AI Interview project
type: project
---

Full-stack AI interview platform: Next.js 14 frontend (port 3000), Express/Socket.io backend (port 5001), MongoDB Atlas, Groq AI (llama-3.3-70b + whisper), Clerk auth.

**Why:** Platform for conducting AI-powered mock interviews with verbal + coding rounds.

**How to apply:** When editing, know that backend runs on 5001, frontend on 3000. MOCK_AI=false means real Groq is used. Auth is Clerk with Bearer tokens via axios interceptor in _app.tsx.

## Fixed bugs (session 2026-04-25)
1. Backend missing `CLERK_PUBLISHABLE_KEY` in .env → added it
2. Backend `FRONTEND_URL` pointed to port 3001 instead of 3000 → fixed
3. `authenticate` middleware used `requireAuth()` which did 302 redirects instead of 401 JSON → changed to check `req.auth?.userId` directly
4. VoiceAssistant TTS/STT used raw `fetch` (no Clerk auth token) → converted to `axios`
5. `extractResumeText` in index.tsx and select.tsx used raw `fetch` → converted to `axios`
6. `recharts` installed in node_modules but missing from package.json → added `^3.8.1`
7. `MOCK_AI=true` was preventing real Groq AI from being used → set to `false`
