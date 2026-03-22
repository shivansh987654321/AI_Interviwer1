import { Request, Response } from 'express';
import geminiService from '../services/gemini.service';
import reportService from '../services/report.service';
import connectToDatabase from '../lib/db';
import InterviewSessionModel from '../models/InterviewSession';

// Generate Question
export const generateQuestion = async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.body;
    const level = typeof difficulty === 'string' ? difficulty : 'medium';
    const question = await geminiService.generateDSAQuestion(level);
    res.json(question);
  } catch (error) {
    console.error('Error generating question:', error);
    res.status(500).json({
      error: 'AI service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Evaluate Answer
export const evaluateAnswer = async (req: Request, res: Response) => {
  try {
    const { sessionId, code, language } = req.body;

    if (!sessionId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connectToDatabase();
    const session = await InterviewSessionModel.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const evaluation = await geminiService.evaluateCode(session.question, code, language);
    res.json(evaluation);
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate code' });
  }
};

// Complete Interview & Generate Report
export const completeInterview = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await connectToDatabase();
    const session = await InterviewSessionModel.findOne({ sessionId }).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const report = await reportService.generateReport({
      id: session.sessionId,
      scores: (session.scores ?? []).map((s: { score: number; verdict: string }) => ({
        score: s.score,
        maxScore: 100,
        feedback: s.verdict,
        verdict: s.verdict,
      })),
      createdAt: new Date(session.createdAt),
    });

    res.json({ report });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
};