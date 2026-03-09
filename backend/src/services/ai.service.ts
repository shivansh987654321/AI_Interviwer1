// Switched from groq-sdk to openai — all AI calls now go through OpenAI GPT-4o
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { DSAQuestion, EvaluationResult } from '../types/interview.types';

dotenv.config();

// Centralized OpenAI service — single source of truth for all AI interactions
class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('⚠️ OPENAI_API_KEY missing. Please set it in your backend/.env file.');
    }
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy_key' });
  }

  /**
   * 🧹 ROBUST JSON CLEANER
   * Handles: Markdown, bad quotes, and conversational wrappers.
   */
  private cleanAndParse(text: string): any {
    try {
      // 1. Remove Markdown wrappers
      let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

      // 2. Extract ONLY the first JSON object
      // This fixes the issue where AI returns "Here is the JSON: { ... } and here is another { ... }"
      const firstBrace = clean.indexOf('{');
      let lastBrace = -1;
      
      // We need to find the MATCHING closing brace, not just the last one
      let braceCount = 0;
      for (let i = firstBrace; i < clean.length; i++) {
        if (clean[i] === '{') braceCount++;
        if (clean[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastBrace = i;
            break;
          }
        }
      }

      if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }

      // 3. Escape bad newlines inside strings (Common AI error)
      clean = clean.replace(/("[\s\S]*?")/g, (match) => {
        return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      });

      return JSON.parse(clean);

    } catch (e) {
      console.error("❌ JSON Parse Failed. Raw text fragment:", text.substring(0, 100) + "...");
      return null;
    }
  }

  // =================================================================
  // PHASE 4: PROBLEM-SOLVING
  // =================================================================
  async generateDSAQuestion(level: string): Promise<DSAQuestion> {
    const prompt = `
      Generate a unique ${level}-level Data Structures and Algorithms (DSA) coding interview question.
      Return STRICT JSON format only.
      
      Structure:
      {
        "title": "Short Title",
        "description": "Problem statement...",
        "difficulty": "${level}",
        "constraints": ["Constraint 1"],
        "testCases": [
           {"input": "arg1=val", "output": "val"}
        ],
        "functionSignature": "function solve(args) {"
      }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        temperature: 0.6,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const question = this.cleanAndParse(rawText);

      if (!question) throw new Error("Parsed JSON was null");

      return {
        title: question.title || "Unknown Problem",
        description: question.description || "No description provided.",
        difficulty: question.difficulty || level,
        testCases: question.testCases || [],
        constraints: question.constraints || [],
        functionSignature: question.functionSignature || "function solution() {"
      };

    } catch (err) {
      console.error('OpenAI Gen Error:', err);
      // FALLBACK
      return {
        title: "Two Sum (Fallback)",
        description: "Given an array of integers, return indices of the two numbers such that they add up to a specific target.",
        difficulty: "easy",
        constraints: ["2 <= nums.length <= 10^4"],
        testCases: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]" }],
        functionSignature: "function twoSum(nums, target) {"
      };
    }
  }

  // =================================================================
  // PHASE 5: CODE EVALUATION
  // =================================================================
  async evaluateCode(question: DSAQuestion, code: string, language: string): Promise<EvaluationResult> {
    const prompt = `
      You are a senior software engineer evaluating a candidate's code submission.

      Problem Title: ${question.title}
      Problem Description: ${question.description}
      Language: ${language}
      Submitted Code:
      \`\`\`${language}
      ${code}
      \`\`\`

      Evaluate the code and return STRICT JSON only:
      {
        "score": number (0-100),
        "verdict": "Accepted" | "Wrong Answer" | "Compilation Error" | "Time Limit Exceeded" | "Runtime Error",
        "feedback": "One-paragraph explanation of the evaluation",
        "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"]
      }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        temperature: 0.2,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      if (!result) throw new Error("Parsed JSON was null");

      return {
        score: typeof result.score === 'number' ? result.score : 0,
        verdict: result.verdict || 'Wrong Answer',
        feedback: result.feedback || 'Could not evaluate the submission.',
        improvements: result.improvements || []
      };

    } catch (err) {
      console.error('Code Evaluation Error:', err);
      // FALLBACK
      return {
        score: 0,
        verdict: 'Wrong Answer',
        feedback: 'Could not evaluate the submission due to an AI error. Please try again.',
        improvements: ['Ensure your solution handles all edge cases.']
      };
    }
  }

  // =================================================================
  // PHASE 1-3: VERBAL CONVERSATION
  // =================================================================
  async generateVerbalResponse(history: { role: string; content: string }[], userMessage: string): Promise<{ text: string; action?: string }> {
    const prompt = `
      ROLE: FAANG Interviewer.
      TASK: Verbal interview.
      
      CONTEXT:
      - History: ${JSON.stringify(history)}
      - Candidate said: "${userMessage}"

      INSTRUCTIONS:
      1. If history is empty, introduce yourself.
      2. Ask ONE technical theory question.
      3. If answer is good, set "action": "START_CODING".
      
      OUTPUT JSON:
      {
        "text": "Response...",
        "action": "CONTINUE" or "START_CODING"
      }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        temperature: 0.6,
      });
      
      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);
      
      return result || { text: "I didn't quite catch that.", action: "CONTINUE" };

    } catch (err) {
      return { text: "Could you please repeat that?", action: "CONTINUE" };
    }
  }

  // =================================================================
  // PHASE 6: FINAL EVALUATION (Report Card)
  // =================================================================
  async generateFinalFeedback(chatHistory: { role: string; content: string }[], codingResult: any): Promise<any> {
    const prompt = `
      Analyze this interview session and provide a JSON report card.
      
      Chat History: ${JSON.stringify(chatHistory)}
      Coding Result: ${JSON.stringify(codingResult)}

      Return STRICT JSON:
      {
        "score": number (0-100),
        "breakdown": {
            "communication": number (0-30),
            "technical": number (0-40),
            "problem_solving": number (0-30)
        },
        "feedback_summary": "1-2 sentences overview",
        "key_strengths": ["point 1", "point 2"],
        "areas_for_improvement": ["point 1", "point 2"]
      }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o', 
        temperature: 0.2, 
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      // 🛡️ CRITICAL CHECK: Ensure 'breakdown' exists
      if (!result || !result.breakdown) {
          throw new Error("Invalid Report Format");
      }

      return result;

    } catch (err) {
      console.error("Feedback Gen Error:", err);
      // ✅ ROBUST FALLBACK (Prevents Frontend Crash)
      return { 
        score: 0, 
        breakdown: {
            communication: 0,
            technical: 0,
            problem_solving: 0
        },
        feedback_summary: "Could not generate report due to AI error.", 
        key_strengths: [], 
        areas_for_improvement: ["System Error - Please try again"] 
      };
    }
  }

  // =================================================================
  // REPORT SERVICE: INTERVIEW FEEDBACK
  // =================================================================
  async generateInterviewFeedback(scores: { score: number; verdict: string; feedback?: string }[]): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const prompt = `
      Analyze the following interview scores and provide structured feedback.

      Scores: ${JSON.stringify(scores)}

      Return STRICT JSON only:
      {
        "strengths": ["Strength 1", "Strength 2"],
        "weaknesses": ["Weakness 1", "Weakness 2"],
        "recommendations": ["Recommendation 1", "Recommendation 2"]
      }
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        temperature: 0.3,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      if (!result) throw new Error("Parsed JSON was null");

      return {
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        recommendations: result.recommendations || []
      };

    } catch (err) {
      console.error('Interview Feedback Error:', err);
      // FALLBACK
      return {
        strengths: ["Attempted all questions"],
        weaknesses: ["Could not generate detailed analysis"],
        recommendations: ["Review data structures and algorithms", "Practice more coding problems"]
      };
    }
  }
}

export default new OpenAIService();
