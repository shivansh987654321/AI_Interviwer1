import { Request, Response } from 'express';
import geminiService from '../services/gemini.service';
import reportService from '../services/report.service';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(__dirname, '../../sessions.json');

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

// Generate Question
export const generateQuestion = async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.body;
    const level = difficulty || 'medium';
    const question = await geminiService.generateDSAQuestion(level as any);
    res.json(question);
  } catch (error) {
    console.error('Error generating question:', error);
    res.status(500).json({ 
      error: "AI service unavailable", 
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

// Evaluate Answer
export const evaluateAnswer = async (req: Request, res: Response) => {
  try {
    const { sessionId, code, language } = req.body;

    if (!sessionId || !code || !language) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sessions = getSessions();
    const session = sessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const evaluation = await geminiService.evaluateCode(session.question, code, language);
    res.json(evaluation);
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: "Failed to evaluate code" });
  }
};

// Complete Interview & Generate Report
export const completeInterview = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessions = getSessions();
    const session = sessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Generate report from scores
    const report = await reportService.generateReport({
      id: session.id,
      scores: session.scores || [],
      createdAt: new Date(session.createdAt)
    } as any);

    res.json({ report });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: "Failed to complete interview" });
  }
};