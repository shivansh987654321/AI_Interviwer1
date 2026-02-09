import Groq from 'groq-sdk';
import { Difficulty, DSAQuestion, EvaluationResult } from '../types/interview.types';

class GeminiService {
  private groq: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('⚠️ GROQ_API_KEY missing. Please set it in your backend/.env file.');
    }
    this.groq = new Groq({ apiKey: apiKey || 'dummy_key' });
  }

  private cleanJson(text: string): string {
    const match = text.match(/```json([\s\S]*?)```/);
    if (match && match[1]) return match[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) return text.substring(firstBrace, lastBrace + 1);
    return text.trim();
  }

  // =================================================================
  // PHASE 4: PROBLEM-SOLVING (Coding Round)
  // =================================================================
  async generateDSAQuestion(difficulty: Difficulty): Promise<DSAQuestion> {
    const prompt = `
      ROLE: Realistic AI Interviewer (FAANG Level).
      PHASE: 4 (Problem-Solving).
      TASK: Ask ONE DSA problem based on difficulty: ${difficulty}.

      Constraint: Do NOT give multiple problems.
      Output: Return ONLY valid JSON.

      JSON Format:
      {
        "title": "Problem Title",
        "description": "Real-world interview problem description...",
        "inputFormat": "Input format...",
        "outputFormat": "Output format...",
        "constraints": "Constraints...",
        "example": {
          "input": "Example input",
          "output": "Example output",
          "explanation": "Brief explanation"
        },
        "starterCode": "function solution() {\\n  // write code here\\n}"
      }
    `;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
      });
      return JSON.parse(this.cleanJson(completion.choices[0]?.message?.content || '{}'));
    } catch (err) {
      console.error('Groq Gen Error:', err);
      // Fallback
      return {
        title: "Two Sum (Fallback)",
        description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        inputFormat: "Array of integers",
        outputFormat: "Array of two integers",
        constraints: "2 <= nums.length <= 10^4",
        example: { input: "nums = [2,7], target = 9", output: "[0,1]", explanation: "2+7=9" },
        starterCode: "function solution(nums, target) {\n  // write code here\n}"
      };
    }
  }

  // =================================================================
  // PHASE 4 EVALUATION (Strict but Human-like)
  // =================================================================
  async evaluateCode(question: DSAQuestion, code: string, language: string): Promise<EvaluationResult> {
    const prompt = `
      ROLE: Realistic AI Interviewer.
      PHASE: 4 (Code Review).
      TASK: Review the candidate's code for: "${question.title}".
      
      Candidate Code (${language}):
      ${code}

      Rules:
      1. Act like a HUMAN interviewer.
      2. If syntax is wrong -> Verdict: "Compilation Error".
      3. If logic is wrong -> Verdict: "Wrong Answer".
      4. If correct -> Verdict: "Accepted".
      
      Output JSON:
      {
        "score": 0-100,
        "verdict": "Accepted | Wrong Answer | Compilation Error",
        "feedback": "Your verbal feedback to the candidate (1-2 sentences).",
        "improvements": ["Optimization tip 1", "Code quality tip 2"]
      }
    `;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
      });
      return JSON.parse(this.cleanJson(completion.choices[0]?.message?.content || '{}'));
    } catch (err) {
      return { score: 0, verdict: "Compilation Error", feedback: "System error. Please retry.", improvements: [] };
    }
  }

  // =================================================================
  // PHASE 5: INTERVIEW CLOSURE (Replaces "Detailed Report")
  // =================================================================
  async generateInterviewFeedback(scores: any[]): Promise<any> {
    const prompt = `
      ROLE: Realistic AI Interviewer.
      PHASE: 5 (Interview Closure).
      CONTEXT: The interview is finishing.
      DATA: Candidate's performance: ${JSON.stringify(scores)}

      INSTRUCTION:
      The "Detailed Report" feature is DELETED. 
      Instead, provide a polite, verbal closing statement.
      
      1. Give verbal feedback on their problem-solving approach.
      2. Mention 1 strength and 1 area for improvement.
      3. End with: "Do you have any questions for me?"

      Return JSON (to satisfy frontend structure):
      {
        "strengths": ["(Verbal feedback strength)"],
        "weaknesses": ["(Verbal feedback improvement)"],
        "recommendations": ["(Final closing words)"]
      }
    `;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
      });
      return JSON.parse(this.cleanJson(completion.choices[0]?.message?.content || '{}'));
    } catch (err) {
      return { 
        strengths: ["Good effort."], 
        weaknesses: ["Connection instability."], 
        recommendations: ["Thank you for your time."] 
      };
    }
  }
}

export default new GeminiService();