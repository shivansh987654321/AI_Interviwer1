import { InterviewSession, InterviewReport } from '../types/interview.types';
import aiService from './ai.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';

class ReportService {
  async generateReport(session: InterviewSession): Promise<InterviewReport> {
    const scores = session.scores ?? [];

    if (scores.length === 0) {
      console.warn(`[ReportService] Session ${session.id} has no scores.`);
      return {
        sessionId: session.id,
        overallScore: 0,
        maxScore: 100,
        percentage: 0,
        scores: [],
        strengths: [],
        weaknesses: ['No questions were submitted.'],
        recommendations: ['Complete at least one question to receive a real report.'],
        generatedAt: new Date(),
      };
    }

    const maxScore = scores.length * 100;
    const achieved = scores.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const percentage = Math.round((achieved / maxScore) * 100);

    const feedback = await aiService.generateInterviewFeedback(scores);

    return {
      sessionId: session.id,
      overallScore: achieved,
      maxScore,
      percentage,
      scores,
      strengths:       feedback.strengths       ?? [],
      weaknesses:      feedback.weaknesses       ?? [],
      recommendations: feedback.recommendations ?? [],
      generatedAt: new Date(),
    };
  }

  async getReportBySessionId(sessionId: string): Promise<InterviewReport | null> {
    try {
      await connectToDatabase();
      const doc = await Interview.findOne({ sessionId }).lean();
      if (!doc) return null;

      return {
        sessionId:       doc.sessionId,
        overallScore:    doc.score,
        maxScore:        100,
        percentage:      doc.score,
        scores:          [],
        strengths:       [],
        weaknesses:      doc.improvements ?? [],
        recommendations: [],
        generatedAt:     doc.date ?? new Date(),
      };
    } catch (err) {
      console.error('[ReportService] getReportBySessionId error:', err);
      return null;
    }
  }

  async saveReport(params: {
    userId: string;
    sessionId: string;
    score: number;
    feedback: string;
    verdict: string;
    improvements: string[];
    verbatim: { role: string; content: string }[];
    difficulty?: string;
    questionsAttempted?: number;
  }): Promise<void> {
    try {
      await connectToDatabase();
      await Interview.findOneAndUpdate(
        { sessionId: params.sessionId },
        { $set: { ...params, date: new Date() } },
        { upsert: true, new: true }
      );
      console.log(`[ReportService] Report saved for session ${params.sessionId}`);
    } catch (err) {
      console.error('[ReportService] saveReport error:', err);
      throw err;
    }
  }
}

export default new ReportService();