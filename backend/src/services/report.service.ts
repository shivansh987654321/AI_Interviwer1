import { InterviewSession, InterviewReport } from '../types/interview.types';
import geminiService from './gemini.service'; 

class ReportService {
  async generateReport(session: InterviewSession): Promise<InterviewReport> {
    const scores = session.scores || []; 
    
    if (scores.length === 0) {
      // Return a basic empty report instead of crashing if no scores exist
      console.warn("Generating report with no scores.");
      return {
          sessionId: session.id,
          overallScore: 0,
          maxScore: 100,
          percentage: 0,
          scores: [],
          strengths: ["N/A"],
          weaknesses: ["N/A"],
          recommendations: ["Complete a question to get a report."],
          generatedAt: new Date()
      };
    }

    // 1. Calculate numerical stats
    const totalMaxScore = scores.length * 100;
    const totalAchievedScore = scores.reduce((sum, s) => sum + s.score, 0);
    const percentage = totalMaxScore > 0 ? Math.round((totalAchievedScore / totalMaxScore) * 100) : 0;

    // 2. Generate AI Feedback using Gemini
    const feedback = await geminiService.generateInterviewFeedback(scores);

    const report: InterviewReport = {
      sessionId: session.id,
      overallScore: totalAchievedScore,
      maxScore: totalMaxScore,
      percentage,
      scores,
      strengths: feedback.strengths || [],
      weaknesses: feedback.weaknesses || [],
      recommendations: feedback.recommendations || [],
      generatedAt: new Date()
    };

    return report;
  }

  async getReportBySessionId(sessionId: string): Promise<InterviewReport | null> {
    // Placeholder for Database logic
    console.warn("getReportBySessionId is not connected to a DB yet.");
    return null;
  }
}

export default new ReportService();