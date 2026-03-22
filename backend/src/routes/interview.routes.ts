import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import geminiService from '../services/gemini.service';
import connectToDatabase from '../lib/db';
import InterviewSessionModel from '../models/InterviewSession';
import { Difficulty, EvaluationResult } from '../types/interview.types';

const PASSING_SCORE_THRESHOLD = 70;

const router = Router();

// =================================================================
// 1. CREATE INTERVIEW
// =================================================================
router.post('/create', async (req, res) => {
  try {
    const { difficulty } = req.body;
    const sessionId = uuidv4();
    const diffLevel = (typeof difficulty === 'string' ? difficulty : 'medium').toLowerCase();

    let duration = 1800;
    if (diffLevel === 'easy') duration = 900;
    if (diffLevel === 'hard') duration = 2700;

    const [q1, q2, q3] = await Promise.all([
      geminiService.generateDSAQuestion(diffLevel),
      geminiService.generateDSAQuestion(diffLevel),
      geminiService.generateDSAQuestion(diffLevel),
    ]);

    await connectToDatabase();

    const session = await InterviewSessionModel.create({
      sessionId,
      questions: [q1, q2, q3],
      currentQuestionIndex: 0,
      question: q1,
      scores: [],
      status: 'active',
      duration,
      startTime: new Date(),
      createdAt: new Date(),
    });

    res.json({ sessionId: session.sessionId, question: q1, duration });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Create failed' });
  }
});

// =================================================================
// 2. SUBMIT CODE
// =================================================================
router.post('/submit', async (req, res) => {
  try {
    const { sessionId, code, language } = req.body;
    if (!sessionId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connectToDatabase();
    const session = await InterviewSessionModel.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session expired' });

    const rawResult = await geminiService.evaluateCode(session.question, code, language);
    const result: EvaluationResult = {
      ...rawResult,
      verdict: rawResult.verdict as EvaluationResult['verdict'],
    };

    session.scores.push({
      score: result.score,
      verdict: result.verdict,
      code,
      questionTitle: session.question.title,
    });

    const responseData: Record<string, unknown> = { ...result };

    const passed = result.verdict === 'Accepted' && result.score >= PASSING_SCORE_THRESHOLD;

    if (passed) {
      const nextIndex = session.currentQuestionIndex + 1;
      if (nextIndex < session.questions.length) {
        session.currentQuestionIndex = nextIndex;
        session.question = session.questions[nextIndex];
        responseData.nextQuestion = session.question;
        responseData.message = 'Correct! Moving to the next question...';
      } else {
        responseData.message = 'All questions completed!';
        responseData.completed = true;
      }
    } else {
      responseData.message = 'Try again to get a better score.';
    }

    await session.save();
    res.json(responseData);
  } catch (e) {
    console.error('Submit error:', e);
    res.status(500).json({ error: 'Eval failed' });
  }
});

// =================================================================
// 3. GET SESSION
// =================================================================
router.get('/:sessionId', async (req, res) => {
  try {
    await connectToDatabase();
    const session = await InterviewSessionModel.findOne({ sessionId: req.params.sessionId }).lean();
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json({ session });
  } catch (e) {
    console.error('Get session error:', e);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// =================================================================
// 4. COMPLETE INTERVIEW
// =================================================================
router.post('/complete/:sessionId', async (req, res) => {
  try {
    await connectToDatabase();
    await InterviewSessionModel.updateOne(
      { sessionId: req.params.sessionId },
      { $set: { status: 'completed' } }
    );
    res.json({ message: 'Interview completed' });
  } catch (e) {
    console.error('Complete error:', e);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
});

export default router;