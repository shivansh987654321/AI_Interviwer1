import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import aiService from '../services/ai.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';
// We use 'as any' to avoid strict type issues during quick development
import { Difficulty, DSAQuestion, EvaluationResult } from '../types/interview.types';

const router = Router();
const DB_FILE = path.join(__dirname, '../../sessions.json');

// --- DATABASE HELPERS ---
// WARNING: File-based storage is not safe for concurrent requests. Use a proper database in production.
const getSessions = (): Record<string, any> => {
  try {
    if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, '{}'); return {}; }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8') || '{}');
  } catch (e) { return {}; }
};

const saveSessionToDb = (session: any) => {
  try {
    const sessions = getSessions();
    sessions[session.id] = session;
    fs.writeFileSync(DB_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) { console.error("DB Save Failed", e); }
};

// =================================================================
// 1. CREATE INTERVIEW (Fixed: Generates questions based on Difficulty)
// =================================================================
router.post('/create', async (req, res) => {
  try {
    const { difficulty } = req.body;
    const sessionId = uuidv4();
    
    // Normalize difficulty (default to medium)
    const diffLevel = (difficulty || 'medium').toLowerCase();

    // Set Duration
    let duration = 1800; // Medium = 30 mins
    if (diffLevel === 'easy') duration = 900;   // Easy = 15 mins
    if (diffLevel === 'hard') duration = 2700;  // Hard = 45 mins

    console.log(`[CREATE] Session: ${sessionId} | Level: ${diffLevel}`);

    // FIX: Generate 3 questions matching the SELECTED difficulty
    // Previously, this was hardcoded to 'easy', 'medium', 'hard' regardless of choice.
    const [q1, q2, q3] = await Promise.all([
      aiService.generateDSAQuestion(diffLevel as Difficulty),
      aiService.generateDSAQuestion(diffLevel as Difficulty),
      aiService.generateDSAQuestion(diffLevel as Difficulty)
    ]);

    const session = {
      id: sessionId,
      startTime: new Date(),
      questions: [q1, q2, q3], 
      currentQuestionIndex: 0,
      question: q1, 
      scores: [],
      status: 'active',
      duration: duration, 
      createdAt: new Date()
    };

    saveSessionToDb(session);
    res.json({ sessionId, question: q1, duration: duration });
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'Create failed' }); 
  }
});

// =================================================================
// 2. SUBMIT CODE (Unified Logic)
// =================================================================
router.post('/submit', async (req, res) => {
  try {
    const { sessionId, code, language } = req.body;

    if (!sessionId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, code, language' });
    }

    const sessions = getSessions();
    const session = sessions[sessionId];

    if (!session) return res.status(404).json({ error: 'Session expired' });

    // Evaluate Code
    const result: EvaluationResult = await aiService.evaluateCode(session.question as DSAQuestion, code, language);
    
    session.scores.push({ 
      score: result.score,
      verdict: result.verdict,
      code,
      questionTitle: session.question.title
    });

    const responseData: any = { ...result };

    // Move to next question if score is good (e.g. > 60) OR if verdict is 'Accepted'
    if (result.score >= 60 || result.verdict === 'Accepted') {
      const nextIndex = session.currentQuestionIndex + 1;
      
      if (nextIndex < session.questions.length) {
        session.currentQuestionIndex = nextIndex;
        session.question = session.questions[nextIndex]; 
        
        responseData.nextQuestion = session.question; 
        responseData.message = "Correct! Moving to the next question...";
      } else {
        responseData.message = "All questions completed!";
        responseData.completed = true;
      }
    } else {
        responseData.message = "Try again to get a better score.";
    }

    saveSessionToDb(session);
    res.json(responseData);
  } catch (e) { 
    console.error('Submit error:', e);
    res.status(500).json({ error: 'Eval failed' }); 
  }
});

// =================================================================
// 3. GET SESSION
// =================================================================
router.get('/:sessionId', (req, res) => {
  const session = getSessions()[req.params.sessionId];
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ session });
});

// =================================================================
// 4. COMPLETE INTERVIEW (Inline to prevent import crash)
// =================================================================
router.post('/complete/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const sessions = getSessions();
    if (sessions[sessionId]) {
      sessions[sessionId].status = 'completed';
      saveSessionToDb(sessions[sessionId]);
    }
    res.json({ message: 'Interview completed' });
});

// =================================================================
// 5. REPORT — returns a saved interview report from MongoDB
// =================================================================
router.get('/report/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  try {
    await connectToDatabase();
    const interview = await Interview.findOne({ sessionId }).lean();
    if (!interview) return res.status(404).json({ error: 'Report not found' });
    res.json({
      score: interview.score,
      feedback: interview.feedback,
      verdict: interview.verdict,
      improvements: interview.improvements || [],
      date: interview.date,
      sessionId: interview.sessionId,
    });
  } catch (err) {
    console.error('Report fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// =================================================================
// 6. HISTORY — returns all past interviews for a given userId
// =================================================================
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    await connectToDatabase();
    const interviews = await Interview.find({ userId })
      .sort({ date: -1 })   // newest first
      .select('sessionId date score feedback verdict')
      .lean();
    res.json({ interviews });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;