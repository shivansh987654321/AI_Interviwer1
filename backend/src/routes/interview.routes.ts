import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import aiService from '../services/ai.service';
import questionService from '../services/question.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';
import { Difficulty, DSAQuestion, EvaluationResult } from '../types/interview.types';

const router = Router();

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
  'audio/wav', 'audio/x-wav', 'audio/mp3', 'video/webm',
]);

const ALLOWED_RESUME_MIMES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// Multer: memory storage, 10 MB cap for audio, 5 MB for docs
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_RESUME_MIMES.has(file.mimetype);
    const extOk  = ['.pdf', '.docx', '.doc', '.txt'].includes(ext);
    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, and TXT files are allowed.'));
    }
  },
});

// ---------------------------------------------------------------------------
// FILE-BASED SESSION STORE
// ---------------------------------------------------------------------------
const SESSION_FILE = path.join(__dirname, '../../sessions.json');
const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;

interface SessionRecord {
  id: string;
  difficulty: string;
  startTime: Date | string;
  questions: DSAQuestion[];
  currentQuestionIndex: number;
  question: DSAQuestion;
  scores: unknown[];
  status: string;
  duration: number;
  createdAt: Date | string;
  userId?: string;
}

const getSessions = (): Record<string, SessionRecord> => {
  try {
    if (!fs.existsSync(SESSION_FILE)) { fs.writeFileSync(SESSION_FILE, '{}'); return {}; }
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
    const sessions: Record<string, SessionRecord> = raw ? JSON.parse(raw) : {};

    // Auto-cleanup: purge sessions older than TTL
    const now = Date.now();
    let purged = false;
    for (const id of Object.keys(sessions)) {
      const created = new Date(sessions[id].createdAt || sessions[id].startTime).getTime();
      if (now - created > SESSION_TTL_MS) {
        delete sessions[id];
        purged = true;
      }
    }
    if (purged) {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
      console.log('[Sessions] Purged stale sessions');
    }
    return sessions;
  } catch { return {}; }
};

const saveSessionToFile = (session: SessionRecord): void => {
  try {
    const sessions = getSessions();
    sessions[session.id] = session;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) { console.error('[Sessions] File Save Failed', e); }
};

const getDuration = (level: string): number => {
  if (level === 'easy') return 900;
  if (level === 'hard') return 2700;
  return 1800;
};

// ===========================================================================
// 0a. TTS — ElevenLabs primary, falls back to OpenAI TTS, then browser speech
// ===========================================================================
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' });
    }
    if (text.length > 4096) {
      return res.status(400).json({ error: 'text must be ≤ 4096 chars' });
    }
    const audioBuffer = await aiService.textToSpeech(text, voice ?? 'alloy');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.length),
      'Cache-Control': 'no-cache',
    });
    res.send(audioBuffer);
  } catch (e) {
    console.error('[TTS] Error:', e);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ===========================================================================
// 0c. PARSE RESUME — extract text from PDF / DOCX / TXT
// ===========================================================================
router.post('/parse-resume', (req: Request, res: Response, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload rejected' });
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { mimetype, buffer, originalname } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    let text = '';

    if (mimetype === 'text/plain' || ext === '.txt') {
      text = buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf' || ext === '.pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const result = await pdfParse(buffer);
        text = result.text || '';
      } catch {
        text = `Resume file: ${originalname} (PDF parsing — install pdf-parse for full support)`;
      }
    } else if (mimetype.includes('wordprocessingml') || ext === '.docx' || ext === '.doc') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } catch {
        text = `Resume file: ${originalname} (DOCX parsing — install mammoth for full support)`;
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    res.json({ text: text.substring(0, 3000) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Resume parsing failed';
    console.error('[parse-resume] Error:', e);
    res.status(500).json({ error: msg, text: '' });
  }
});

// ===========================================================================
// 0b. STT — uses ai.service (OpenAI / Groq Whisper)
// ===========================================================================
router.post('/stt', uploadAudio.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });

    const buffer = req.file.buffer;
    const mime   = req.file.mimetype || 'audio/webm';

    // Validate MIME type
    if (!ALLOWED_AUDIO_MIMES.has(mime)) {
      console.warn(`[STT] Rejected mime type: ${mime}`);
      return res.status(400).json({ error: 'Unsupported audio format' });
    }

    console.log(`[STT] Received ${buffer.length} bytes, mime: ${mime}`);

    if (buffer.length < 500) {
      console.warn('[STT] Audio too small, skipping');
      return res.json({ text: '' });
    }

    const text = await aiService.speechToText(buffer, mime);
    const trimmed = text?.trim() || '';

    console.log(`[STT] Transcribed: "${trimmed}"`);
    res.json({ text: trimmed });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[STT] Error:', msg);
    res.json({ text: '' });
  }
});

// ===========================================================================
// 1. CREATE INTERVIEW
// ===========================================================================
router.post('/create', async (req: Request, res: Response) => {
  try {
    const difficulty = ((req.body.difficulty as string) || 'medium').toLowerCase() as Difficulty;
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });
    }
    const userId = typeof req.body.userId === 'string' ? req.body.userId : undefined;
    const sessionId = uuidv4();
    const duration  = getDuration(difficulty);
    console.log(`[CREATE] Session: ${sessionId} | Difficulty: ${difficulty}`);
    const questions = await questionService.generateQuestions(difficulty, 3);
    const [q1] = questions;
    const session: SessionRecord = {
      id: sessionId, difficulty, startTime: new Date(),
      questions, currentQuestionIndex: 0, question: q1,
      scores: [], status: 'active', duration, createdAt: new Date(),
      userId,
    };
    saveSessionToFile(session);
    res.status(201).json({ sessionId, question: q1, duration });
  } catch (e) {
    console.error('[CREATE] Error:', e);
    res.status(500).json({ error: 'Failed to create interview session' });
  }
});

// ===========================================================================
// 2. SUBMIT CODE
// ===========================================================================
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { sessionId, code, language, userId } = req.body;
    if (!sessionId || !code || !language) {
      return res.status(400).json({ error: 'Missing: sessionId, code, language' });
    }
    const sessions = getSessions();
    const session  = sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'Already completed' });
    }

    // Ownership check: if session was created with a userId, verify it matches
    if (session.userId && userId && session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result: EvaluationResult = await aiService.evaluateCode(
      session.question as DSAQuestion, code, language
    );

    session.scores.push({
      score: result.score, verdict: result.verdict,
      feedback: result.feedback, code, language,
      questionTitle: session.question.title,
      submittedAt: new Date(),
    });

    const responseData: Record<string, unknown> = { ...result };
    const passing = result.score >= 60 || result.verdict === 'Accepted';

    if (passing) {
      const nextIndex = session.currentQuestionIndex + 1;
      if (nextIndex < session.questions.length) {
        session.currentQuestionIndex = nextIndex;
        session.question = session.questions[nextIndex];
        responseData.nextQuestion  = session.question;
        responseData.questionIndex = nextIndex;
        responseData.message = 'Correct! Moving to the next question…';
      } else {
        session.status       = 'completed';
        responseData.completed = true;
        responseData.message = 'All questions completed!';
      }
    } else {
      responseData.message = `Score ${result.score}/100 — keep trying!`;
    }

    saveSessionToFile(session);
    res.json(responseData);
  } catch (e) {
    console.error('[SUBMIT] Error:', e);
    res.status(500).json({ error: 'Code evaluation failed' });
  }
});

// ===========================================================================
// 5. REPORT — must be BEFORE /:sessionId
// ===========================================================================
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  try {
    await connectToDatabase();
    const interview = await Interview.findOne({ sessionId: req.params.sessionId }).lean();
    if (!interview) return res.status(404).json({ error: 'Report not found' });
    res.json({
      sessionId:    interview.sessionId,
      score:        interview.score,
      feedback:     interview.feedback,
      verdict:      interview.verdict,
      improvements: interview.improvements ?? [],
      date:         interview.date,
    });
  } catch (err) {
    console.error('[REPORT] Error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ===========================================================================
// 6. HISTORY — must be BEFORE /:sessionId
// ===========================================================================
router.get('/history/:userId', async (req: Request, res: Response) => {
  if (!req.params.userId) return res.status(400).json({ error: 'userId required' });
  try {
    await connectToDatabase();
    const interviews = await Interview.find({ userId: req.params.userId })
      .sort({ date: -1 })
      .select('sessionId date score feedback verdict difficulty')
      .lean();
    res.json({ interviews });
  } catch (err) {
    console.error('[HISTORY] Error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ===========================================================================
// 3. GET SESSION — catch-all, MUST be last
// ===========================================================================
router.get('/:sessionId', (req: Request, res: Response) => {
  const session = getSessions()[req.params.sessionId];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

// ===========================================================================
// 4. COMPLETE
// ===========================================================================
router.post('/complete/:sessionId', (req: Request, res: Response) => {
  const sessions = getSessions();
  if (!sessions[req.params.sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  sessions[req.params.sessionId].status = 'completed';
  (sessions[req.params.sessionId] as SessionRecord & { completedAt?: Date }).completedAt = new Date();
  saveSessionToFile(sessions[req.params.sessionId]);
  res.json({ message: 'Completed' });
});

export default router;
