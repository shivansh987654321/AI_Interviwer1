import OpenAI, { toFile } from 'openai';
import dotenv from 'dotenv';
import { DSAQuestion, EvaluationResult } from '../types/interview.types';

dotenv.config();

class AIService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('⚠️ GROQ_API_KEY missing. Please set it in backend/.env');
    }
    // Groq is 100% OpenAI-SDK compatible — sirf baseURL change hai
    this.client = new OpenAI({
      apiKey: apiKey || 'dummy_key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
    console.log('🟢 AI Service: Groq (FREE) initialized');
  }

  // ================================================================
  // INTERNAL: JSON CLEANER
  // ================================================================
  private cleanAndParse(text: string): any {
    try {
      let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const firstBrace = clean.indexOf('{');
      let lastBrace = -1;
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

      clean = clean.replace(/("[\s\S]*?")/g, (match) =>
        match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      );

      return JSON.parse(clean);
    } catch (e) {
      console.error('❌ JSON Parse Failed. Fragment:', text.substring(0, 150));
      return null;
    }
  }

  // ================================================================
  // TTS — Groq has no TTS, so we return empty buffer.
  // Frontend (VoiceAssistant.tsx) will use browser's Web Speech API.
  // ================================================================
  async textToSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
    // Empty buffer — frontend handles speech via speechSynthesis
    return Buffer.alloc(0);
  }

  // ================================================================
  // STT — Groq Whisper (FREE, very fast)
  // ================================================================
  async speechToText(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    try {
      const ext = mimeType.includes('wav') ? 'wav'
                : mimeType.includes('mp4') ? 'mp4'
                : 'webm';

      const file = await toFile(audioBuffer, `recording.${ext}`, { type: mimeType });

      const transcription = await this.client.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        language: 'en',
      });

      return transcription.text;
    } catch (err) {
      console.error('❌ STT Error:', err);
      throw err;
    }
  }

  // ================================================================
  // DSA QUESTION GENERATION — Groq LLaMA 3.3 70B (FREE)
  // ================================================================
  async generateDSAQuestion(level: string): Promise<DSAQuestion> {
    const prompt = `Generate a unique ${level}-level Data Structures and Algorithms coding interview question.
Return STRICT JSON only — no extra text, no markdown:
{
  "title": "Short descriptive title",
  "description": "Clear problem statement with examples",
  "difficulty": "${level}",
  "constraints": ["Constraint 1", "Constraint 2"],
  "testCases": [
    {"input": "example input 1", "output": "example output 1"},
    {"input": "example input 2", "output": "example output 2"}
  ],
  "functionSignature": "function solve(args) {"
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6,
        max_tokens: 1000,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const question = this.cleanAndParse(rawText);

      if (!question) throw new Error('Parsed JSON was null');

      return {
        title:             question.title             || 'Unknown Problem',
        description:       question.description       || 'No description provided.',
        difficulty:        question.difficulty        || level,
        testCases:         question.testCases         || [],
        constraints:       question.constraints       || [],
        functionSignature: question.functionSignature || 'function solution() {',
      };
    } catch (err) {
      console.error('❌ Question Gen Error:', err);
      return {
        title: 'Two Sum (Fallback)',
        description: 'Given an array of integers nums and a target integer target, return indices of the two numbers that add up to target. You may assume that each input would have exactly one solution.',
        difficulty: level,
        constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Only one valid answer exists'],
        testCases: [
          { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
          { input: 'nums = [3,2,4], target = 6',     output: '[1,2]' },
        ],
        functionSignature: 'function twoSum(nums, target) {',
      };
    }
  }

  // ================================================================
  // CODE EVALUATION — Groq LLaMA 3.3 70B (FREE)
  // ================================================================
  async evaluateCode(question: DSAQuestion, code: string, language: string): Promise<EvaluationResult> {
    const prompt = `You are a senior software engineer evaluating a candidate's code submission.

Problem Title: ${question.title}
Problem Description: ${question.description}
Language: ${language}
Submitted Code:
\`\`\`${language}
${code}
\`\`\`

Evaluate strictly and return STRICT JSON only:
{
  "score": <number 0-100>,
  "verdict": "<Accepted|Wrong Answer|Compilation Error|Time Limit Exceeded|Runtime Error>",
  "feedback": "<one paragraph explanation>",
  "improvements": ["suggestion 1", "suggestion 2"]
}

Scoring guide:
- 90-100: Perfect solution, optimal time and space
- 70-89: Correct but not optimal
- 50-69: Partially correct
- 0-49: Wrong or incomplete`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 800,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      if (!result) throw new Error('Parsed JSON was null');

      return {
        score:        typeof result.score === 'number' ? result.score : 0,
        verdict:      result.verdict      || 'Wrong Answer',
        feedback:     result.feedback     || 'Could not evaluate the submission.',
        improvements: result.improvements || [],
      };
    } catch (err) {
      console.error('❌ Code Evaluation Error:', err);
      return {
        score:        0,
        verdict:      'Wrong Answer',
        feedback:     'Could not evaluate the submission due to an error. Please try again.',
        improvements: ['Ensure your solution handles all edge cases.'],
      };
    }
  }

  // ================================================================
  // VERBAL INTERVIEW — Groq LLaMA 3.3 70B (FREE)
  // ================================================================
  async generateVerbalResponse(
    history: { role: string; content: string }[],
    userMessage: string
  ): Promise<{ text: string; action?: string }> {
    const prompt = `You are Alex, a senior FAANG engineer conducting a technical interview.

Conversation history: ${JSON.stringify(history)}
Candidate just said: "${userMessage}"

Rules:
1. If history is empty, briefly introduce yourself as Alex and ask ONE theory question about data structures or algorithms.
2. Keep ALL responses SHORT — maximum 2-3 sentences.
3. Ask only ONE question at a time. Never multiple questions.
4. After the candidate answers 2-3 questions reasonably well, move to coding.
5. If answer is wrong, give a small hint and try a simpler question.
6. Be encouraging and professional.

Return STRICT JSON only:
{
  "text": "Your spoken response here",
  "action": "CONTINUE"
}

When ready to move to coding (after 2-3 good answers):
{
  "text": "Excellent work! You have demonstrated strong understanding of the concepts. Let us now move to the coding challenge.",
  "action": "START_CODING"
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 300,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      return result || { text: "I didn't quite catch that. Could you repeat?", action: 'CONTINUE' };
    } catch (err) {
      console.error('❌ Verbal Response Error:', err);
      return { text: 'Could you please repeat that?', action: 'CONTINUE' };
    }
  }

  // ================================================================
  // FINAL REPORT — Groq LLaMA 3.3 70B (FREE)
  // ================================================================
  async generateFinalFeedback(
    chatHistory: { role: string; content: string }[],
    codingResult: any
  ): Promise<any> {
    const prompt = `Analyze this complete interview session and generate a detailed report card.

Chat History: ${JSON.stringify(chatHistory)}
Coding Results: ${JSON.stringify(codingResult)}

Return STRICT JSON only:
{
  "score": <number 0-100>,
  "breakdown": {
    "communication": <number 0-30>,
    "technical": <number 0-40>,
    "problem_solving": <number 0-30>
  },
  "feedback_summary": "1-2 sentence overview of performance",
  "key_strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["area 1", "area 2"]
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 800,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      if (!result || !result.breakdown) throw new Error('Invalid Report Format');

      return result;
    } catch (err) {
      console.error('❌ Feedback Gen Error:', err);
      return {
        score: 0,
        breakdown: { communication: 0, technical: 0, problem_solving: 0 },
        feedback_summary: 'Could not generate report due to an error.',
        key_strengths: [],
        areas_for_improvement: ['System Error — Please try again'],
      };
    }
  }

  // ================================================================
  // INTERVIEW FEEDBACK (for Report Service) — Groq LLaMA (FREE)
  // ================================================================
  async generateInterviewFeedback(
    scores: { score: number; verdict: string; feedback?: string }[]
  ): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const prompt = `Analyze these coding interview scores and provide structured feedback.

Scores: ${JSON.stringify(scores)}

Return STRICT JSON only:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 500,
      });

      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);

      if (!result) throw new Error('Parsed JSON was null');

      return {
        strengths:       result.strengths       || [],
        weaknesses:      result.weaknesses       || [],
        recommendations: result.recommendations || [],
      };
    } catch (err) {
      console.error('❌ Interview Feedback Error:', err);
      return {
        strengths:       ['Attempted all questions'],
        weaknesses:      ['Could not generate detailed analysis'],
        recommendations: ['Review data structures and algorithms', 'Practice more coding problems'],
      };
    }
  }
}

// ================================================================
// MOCK MODE — MOCK_AI=true in .env to skip all API calls
// ================================================================
import mockAIService from './mock.ai.service';

const isMockMode = process.env.MOCK_AI === 'true';
if (isMockMode) {
  console.log('🟡 MOCK_AI mode enabled — Groq calls are disabled.');
}

export default isMockMode ? mockAIService : new AIService();