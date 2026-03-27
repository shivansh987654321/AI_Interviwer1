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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// FILE-BASED SESSION STORE
// WARNING: Not safe for concurrent requests or horizontal scaling.
//          Replace with Redis or MongoDB in production.
// ---------------------------------------------------------------------------
const DB_FILE = path.join(__dirname, '../../sessions.json');

const getSessions = (): Record<string, any> => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, '{}');
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveSessionToDb = (session: any): void => {
  try {
    const sessions = getSessions();
    sessions[session.id] = session;
    fs.writeFileSync(DB_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('[Sessions] DB Save Failed', e);
  }
};

const getDuration = (level: string): number => {
  if (level === 'easy') return 900;
  if (level === 'hard') return 2700;
  return 1800;
};

// ===========================================================================
// 0a. TEXT-TO-SPEECH
// ===========================================================================
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    if (text.length > 4096) {
      return res.status(400).json({ error: 'text must be ≤ 4096 characters' });
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
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

// ===========================================================================
// 0b. SPEECH-TO-TEXT
// ===========================================================================
router.post('/stt', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    const mimeType = req.file.mimetype || 'audio/webm';
    const text = await aiService.speechToText(req.file.buffer, mimeType);
    res.json({ text });
  } catch (e) {
    console.error('[STT] Error:', e);
    res.status(500).json({ error: 'Speech-to-text failed' });
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

    const sessionId = uuidv4();
    const duration  = getDuration(difficulty);

    console.log(`[CREATE] Session: ${sessionId} | Difficulty: ${difficulty}`);

    const questions = await questionService.generateQuestions(difficulty, 3);
    const [q1] = questions;

    const session = {
      id:                   sessionId,
      difficulty,
      startTime:            new Date(),
      questions,
      currentQuestionIndex: 0,
      question:             q1,
      scores:               [],
      status:               'active',
      duration,
      createdAt:            new Date(),
    };

    saveSessionToDb(session);
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
    const { sessionId, code, language } = req.body;

    if (!sessionId || !code || !language) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, code, language',
      });
    }

    const sessions = getSessions();
    const session  = sessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'This interview session is already completed' });
    }

    const result: EvaluationResult = await aiService.evaluateCode(
      session.question as DSAQuestion,
      code,
      language
    );

    session.scores.push({
      score:         result.score,
      verdict:       result.verdict,
      feedback:      result.feedback,
      code,
      language,
      questionTitle: session.question.title,
      submittedAt:   new Date(),
    });

    const responseData: Record<string, any> = { ...result };
    const passing = result.score >= 60 || result.verdict === 'Accepted';

    if (passing) {
      const nextIndex = session.currentQuestionIndex + 1;

      if (nextIndex < session.questions.length) {
        session.currentQuestionIndex = nextIndex;
        session.question             = session.questions[nextIndex];

        responseData.nextQuestion  = session.question;
        responseData.questionIndex = nextIndex;
        responseData.message       = 'Correct! Moving to the next question…';
      } else {
        session.status         = 'completed';
        responseData.completed = true;
        responseData.message   = 'All questions completed! Great job.';
      }
    } else {
      responseData.message = `Score ${result.score}/100 — keep trying!`;
    }

    saveSessionToDb(session);
    res.json(responseData);
  } catch (e) {
    console.error('[SUBMIT] Error:', e);
    res.status(500).json({ error: 'Code evaluation failed' });
  }
});

// ===========================================================================
// 5. REPORT — must be declared BEFORE /:sessionId
// ===========================================================================
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    await connectToDatabase();
    const interview = await Interview.findOne({ sessionId }).lean();

    if (!interview) {
      return res.status(404).json({ error: 'Report not found. The interview may not have been saved yet.' });
    }

    res.json({
      sessionId:    interview.sessionId,
      score:        interview.score,
      feedback:     interview.feedback,
      verdict:      interview.verdict,
      improvements: interview.improvements ?? [],
      difficulty:   (interview as any).difficulty,
      date:         interview.date,
    });
  } catch (err) {
    console.error('[REPORT] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ===========================================================================
// 6. HISTORY — must be declared BEFORE /:sessionId
// ===========================================================================
router.get('/history/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    await connectToDatabase();
    const interviews = await Interview.find({ userId })
      .sort({ date: -1 })
      .select('sessionId date score feedback verdict difficulty questionsAttempted')
      .lean();

    res.json({ interviews });
  } catch (err) {
    console.error('[HISTORY] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch interview history' });
  }
});

// ===========================================================================
// 3. GET SESSION — catch-all, must be LAST among GET routes
// ===========================================================================
router.get('/:sessionId', (req: Request, res: Response) => {
  const session = getSessions()[req.params.sessionId];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ session });
});

// ===========================================================================
// 4. COMPLETE INTERVIEW
// ===========================================================================
router.post('/complete/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const sessions = getSessions();

  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  sessions[sessionId].status      = 'completed';
  sessions[sessionId].completedAt = new Date();
  saveSessionToDb(sessions[sessionId]);

  res.json({ message: 'Interview marked as completed' });
});

export default router;