import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import dotenv from 'dotenv';
import { DSAQuestion, EvaluationResult } from '../types/interview.types';

dotenv.config();

// ================================================================
// PROVIDER DETECTION
// ================================================================
const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const GROQ_KEY        = process.env.GROQ_API_KEY;
const ELEVENLABS_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam — professional male

type ChatProvider = 'openai' | 'groq';
type TTSProvider  = 'elevenlabs' | 'openai' | 'browser';

function getChatProvider(): ChatProvider {
  if (OPENAI_KEY && OPENAI_KEY.length > 20 && !OPENAI_KEY.includes('your_')) return 'openai';
  if (GROQ_KEY   && GROQ_KEY.length > 20)   return 'groq';
  return 'openai'; // will fail with a clear API error
}

function getTTSProvider(): TTSProvider {
  if (ELEVENLABS_KEY && ELEVENLABS_KEY.length > 20 && !ELEVENLABS_KEY.includes('your_')) return 'elevenlabs';
  if (OPENAI_KEY    && OPENAI_KEY.length > 20    && !OPENAI_KEY.includes('your_'))    return 'openai';
  return 'browser';
}

const CHAT_PROVIDER = getChatProvider();
const TTS_PROVIDER  = getTTSProvider();

// ================================================================
// CLIENTS
// ================================================================
function buildChatClient(): OpenAI {
  if (CHAT_PROVIDER === 'groq') {
    return new OpenAI({
      apiKey:  GROQ_KEY!,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return new OpenAI({ apiKey: OPENAI_KEY || 'dummy_key' });
}

// Model aliases per chat provider
const MODELS = {
  chat: CHAT_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o',
  stt:  CHAT_PROVIDER === 'groq' ? 'whisper-large-v3'        : 'whisper-1',
};

// ================================================================
// AI SERVICE CLASS
// ================================================================
class AIService {
  private chatClient:     OpenAI;
  private elevenLabs:     ElevenLabsClient | null;
  private chatProvider:   ChatProvider;
  private ttsProvider:    TTSProvider;

  constructor() {
    this.chatProvider = CHAT_PROVIDER;
    this.ttsProvider  = TTS_PROVIDER;
    this.chatClient   = buildChatClient();

    // ElevenLabs client — only when key is set
    this.elevenLabs = ELEVENLABS_KEY
      ? new ElevenLabsClient({ apiKey: ELEVENLABS_KEY })
      : null;

    if (!OPENAI_KEY && !GROQ_KEY) {
      console.error('⚠️ No chat AI key found. Set OPENAI_API_KEY or GROQ_API_KEY in .env');
    }

    console.log(`🟢 Chat Provider : ${this.chatProvider === 'groq' ? 'Groq (llama-3.3-70b)' : 'OpenAI (GPT-4o)'}`);
    console.log(`🎙️ TTS Provider  : ${this.ttsProvider === 'elevenlabs' ? 'ElevenLabs (ultra-realistic)' : this.ttsProvider === 'openai' ? 'OpenAI TTS' : 'Browser speechSynthesis (fallback)'}`);
    console.log(`🎤 STT Provider  : ${this.chatProvider === 'groq' ? 'Groq Whisper' : 'OpenAI Whisper'}`);
  }

  // ================================================================
  // INTERNAL HELPERS
  // ================================================================
  private str(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
  }
  private strArr(v: unknown): string[] {
    return Array.isArray(v) ? (v as string[]) : [];
  }

  // ================================================================
  // INTERNAL: JSON CLEANER
  // ================================================================
  private cleanAndParse(text: string): Record<string, unknown> | null {
    try {
      let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBrace = clean.indexOf('{');
      let lastBrace = -1;
      let braceCount = 0;
      for (let i = firstBrace; i < clean.length; i++) {
        if (clean[i] === '{') braceCount++;
        if (clean[i] === '}') {
          braceCount--;
          if (braceCount === 0) { lastBrace = i; break; }
        }
      }
      if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
      clean = clean.replace(/(\"[\s\S]*?\")/g, (match) =>
        match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      );
      return JSON.parse(clean);
    } catch (e) {
      console.error('❌ JSON Parse Failed. Fragment:', text.substring(0, 150));
      return null;
    }
  }

  // ================================================================
  // TTS — Priority: ElevenLabs → OpenAI TTS → Empty buffer (browser)
  // ================================================================
  async textToSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
    // ---- 1. ElevenLabs (best quality) ----
    if (this.ttsProvider === 'elevenlabs' && this.elevenLabs) {
      try {
        const audioStream = await this.elevenLabs.textToSpeech.convert(
          ELEVENLABS_VOICE,
          {
            text,
            modelId: 'eleven_multilingual_v2',     // best quality model
            voiceSettings: {
              stability:        0.45,               // natural variation
              similarityBoost:  0.80,               // close to the voice
              style:            0.35,               // slight expressiveness
              useSpeakerBoost:  true,
            },
          }
        );

        // SDK returns a Readable stream — collect into Buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of audioStream as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch (err) {
        console.error('❌ ElevenLabs TTS Error:', err);
        console.warn('⚠️ Falling back to OpenAI TTS...');
        // Fall through to OpenAI TTS
      }
    }

    // ---- 2. OpenAI TTS (fallback) ----
    if (OPENAI_KEY && OPENAI_KEY.length > 20 && !OPENAI_KEY.includes('your_')) {
      try {
        const openaiClient = new OpenAI({ apiKey: OPENAI_KEY });
        const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
        type OpenAIVoice = typeof VALID_VOICES[number];
        const safeVoice: OpenAIVoice = (VALID_VOICES as readonly string[]).includes(voice)
          ? (voice as OpenAIVoice)
          : 'alloy';
        const response = await openaiClient.audio.speech.create({
          model: 'tts-1',
          voice: safeVoice,
          input: text,
          response_format: 'mp3',
        });
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (err) {
        console.error('❌ OpenAI TTS fallback Error:', err);
      }
    }

    // ---- 3. Return empty buffer → browser speechSynthesis handles it ----
    console.warn('[TTS] All TTS providers failed — returning empty buffer (browser fallback).');
    return Buffer.alloc(0);
  }

  // ================================================================
  // STT — OpenAI Whisper OR Groq Whisper (same API shape)
  // ================================================================
  async speechToText(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    const id = randomUUID();
    const tempInPath = path.join(os.tmpdir(), `stt_in_${id}.webm`);
    const tempOutPath = path.join(os.tmpdir(), `stt_out_${id}.mp3`);
    
    try {
      // 1. Write the raw browser buffer to temp WebM file
      fs.writeFileSync(tempInPath, audioBuffer);

      // 2. Browser WebM files lack proper duration headers. OpenAI's Whisper fixes this automatically,
      // but Groq's API instantly rejects them as "invalid media files" (400).
      // Converting to MP3 via ffmpeg purges corrupt headers and forces a clean file.
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempInPath)
          .toFormat('mp3')
          .on('error', (err: any) => reject(err))
          .on('end', () => resolve())
          .save(tempOutPath);
      });

      // 3. Send the clean MP3 to the STT API
      const transcription = await this.chatClient.audio.transcriptions.create({
        model: MODELS.stt,
        file: fs.createReadStream(tempOutPath),
        language: 'en',
        response_format: 'json',
      });

      return transcription.text?.trim() || '';
    } catch (err) {
      console.error('❌ STT Error:', err);
      // Fallback: If it's just silence, don't crash
      return '';
    } finally {
      // 4. Clean up temp files
      if (fs.existsSync(tempInPath))  fs.unlinkSync(tempInPath);
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    }
  }

  // ================================================================
  // DSA QUESTION GENERATION
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
      const completion = await this.chatClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const question = this.cleanAndParse(rawText);
      if (!question) throw new Error('Parsed JSON was null');
      return {
        title:             this.str(question.title,             'Unknown Problem'),
        description:       this.str(question.description,       'No description provided.'),
        difficulty:        this.str(question.difficulty,        level),
        testCases:         Array.isArray(question.testCases)  ? (question.testCases as { input: string; output: string }[]) : [],
        constraints:       this.strArr(question.constraints),
        functionSignature: this.str(question.functionSignature, 'function solution() {'),
      };
    } catch (err) {
      console.error('❌ Question Gen Error (using fallback):', err);
      return {
        title: 'Two Sum',
        description: 'Given an array of integers nums and a target integer target, return indices of the two numbers that add up to target.',
        difficulty: level,
        constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
        testCases: [
          { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
          { input: 'nums = [3,2,4], target = 6',     output: '[1,2]' },
        ],
        functionSignature: 'function twoSum(nums, target) {',
        isFallback: true,
      } as DSAQuestion & { isFallback: boolean };
    }
  }

  // ================================================================
  // CODE EVALUATION
  // ================================================================
  async evaluateCode(
    question: DSAQuestion,
    code: string,
    language: string
  ): Promise<EvaluationResult> {
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
- 90-100: Perfect, optimal time and space complexity
- 70-89: Correct but not optimal
- 50-69: Partially correct
- 0-49: Wrong or incomplete`;

    try {
      const completion = await this.chatClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);
      if (!result) throw new Error('Parsed JSON was null');
      return {
        score:        typeof result.score === 'number' ? result.score : 0,
        verdict:      this.str(result.verdict,  'Wrong Answer') as EvaluationResult['verdict'],
        feedback:     this.str(result.feedback, 'Could not evaluate.'),
        improvements: this.strArr(result.improvements),
      };
    } catch (err) {
      console.error('❌ Code Evaluation Error:', err);
      return {
        score: 0,
        verdict: 'Wrong Answer',
        feedback: 'Could not evaluate the submission. Please try again.',
        improvements: ['Ensure your solution handles all edge cases.'],
      };
    }
  }

  // ================================================================
  // VERBAL INTERVIEW — realistic FAANG interviewer
  // ================================================================
  async generateVerbalResponse(
    history: { role: string; content: string }[],
    userMessage: string,
    resumeContext?: string,
    timeRemainingSeconds?: number,
    tabSwitchCount?: number
  ): Promise<{ text: string; action?: string; difficulty_level: 'warmup' | 'easy' | 'medium' | 'hard' }> {

    const turnCount = history.filter(h => h.role === 'user').length;
    const timeWarning = timeRemainingSeconds !== undefined && timeRemainingSeconds < 120
      ? `\nSYSTEM: Only ${Math.ceil(timeRemainingSeconds / 60)} minute(s) remaining. Transition to coding soon.`
      : '';
    const resumeSection = resumeContext
      ? `\nCANDIDATE RESUME:\n${resumeContext.substring(0, 1200)}\n`
      : '';
    const tabWarning = (tabSwitchCount ?? 0) >= 3
      ? `\nSYSTEM: TAB_SWITCH_COUNT = ${tabSwitchCount}. TERMINATE the interview immediately.`
      : '';

    const systemPrompt = `You are Alex, a highly realistic technical interviewer from a top tech company. Behave exactly like a real human interviewer — professional, slightly strict. No emojis, no casual tone, no chatbot behavior.

INTERVIEW FLOW (STRICT — never expose phase names):
1. OPENING: Greet briefly, ask candidate to introduce themselves.
2. INTRO EVAL: Evaluate clarity, confidence, structure. If weak — probe deeper critically. If strong — move forward. Ask 1-2 follow-ups based only on what they said.
3. TRANSITION: Move naturally. "Alright, let's talk about your projects." Never announce phase changes.
4. RESUME/PROJECT DEEP DIVE: Ask strictly from their projects, skills, tech stack. Focus on implementation, decisions, challenges, trade-offs. Shallow answers — go deeper. Strong answers — increase difficulty.
5. CORE TECHNICAL: Gradually shift to OS, DBMS, Computer Networks. Never announce "now OS round." Say naturally: "Since you've worked with systems, let me ask you this..." Start medium, go hard. If struggling — test fundamentals.
6. PRESSURE: If silent too long — prompt once: "Are you there?" then move forward.
7. CODING TRANSITION: After sufficient questioning say naturally: "Alright, let's move to a coding problem."

ANTI-CHEATING: If TAB_SWITCH_COUNT >= 3, say EXACTLY: "The interview has been terminated due to multiple tab switches. This behavior is considered a violation of interview integrity." Set action to TERMINATE.

RULES:
- Never ask random or unrelated questions
- Never break interview flow
- Keep ALL responses to 2-3 sentences MAX
- Ask ONE question at a time, never two
- Sound human, not like an assistant`;

    const userPrompt = `${resumeSection}${tabWarning}${timeWarning}

Conversation so far (${turnCount} candidate turns):
${JSON.stringify(history.slice(-12))}

Candidate just said: "${userMessage}"

Internal difficulty tracking (never expose this):
Turn 0-2: warmup | Turn 3-5: easy | Turn 6-8: medium | Turn 9+: hard
Current turn: ${turnCount}

Return STRICT JSON only — no markdown, no extra text:
{"text":"your 2-3 sentence response","action":"CONTINUE","difficulty_level":"warmup"}

action values: "CONTINUE" | "START_CODING" | "TERMINATE"`;

    try {
      const completion = await this.chatClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        model: MODELS.chat,
        temperature: 0.5,
        max_tokens: 500, // Slightly increased to prevent cut JSON
        response_format: { type: 'json_object' },
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);
      if (!result) {
        return { text: "I didn't catch that. Could you repeat?", action: 'CONTINUE', difficulty_level: 'easy' };
      }
      const dl = this.str(result.difficulty_level);
      return {
        text: this.str(result.text, "I didn't catch that."),
        action: this.str(result.action, 'CONTINUE'),
        difficulty_level: (['warmup', 'easy', 'medium', 'hard'].includes(dl)
          ? dl
          : 'easy') as 'warmup' | 'easy' | 'medium' | 'hard',
      };
    } catch (err) {
      console.error('❌ Verbal Response Error:', err);
      return { text: 'Could you please repeat that?', action: 'CONTINUE', difficulty_level: 'easy' };
    }
  }

  // ================================================================
  // FINAL REPORT
  // ================================================================
  async generateFinalFeedback(
    chatHistory: { role: string; content: string }[],
    codingResult: Record<string, unknown> | undefined
  ): Promise<{
    score: number;
    breakdown: { communication: number; technical: number; problem_solving: number };
    feedback_summary: string;
    key_strengths: string[];
    areas_for_improvement: string[];
  }> {
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
      const completion = await this.chatClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.2,
        max_tokens: 800,
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);
      if (!result || !result.breakdown) throw new Error('Invalid Report Format');
      const bd = result.breakdown as Record<string, unknown>;
      return {
        score:                typeof result.score === 'number' ? result.score : 0,
        breakdown: {
          communication:  typeof bd.communication  === 'number' ? bd.communication  : 0,
          technical:       typeof bd.technical      === 'number' ? bd.technical      : 0,
          problem_solving: typeof bd.problem_solving === 'number' ? bd.problem_solving : 0,
        },
        feedback_summary:     this.str(result.feedback_summary, 'No summary available.'),
        key_strengths:        this.strArr(result.key_strengths),
        areas_for_improvement: this.strArr(result.areas_for_improvement),
      };
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
  // INTERVIEW FEEDBACK (for Report Service)
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
      const completion = await this.chatClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.3,
        max_tokens: 500,
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const result = this.cleanAndParse(rawText);
      if (!result) throw new Error('Parsed JSON was null');
      return {
        strengths:       this.strArr(result.strengths),
        weaknesses:      this.strArr(result.weaknesses),
        recommendations: this.strArr(result.recommendations),
      };
    } catch (err) {
      console.error('❌ Interview Feedback Error:', err);
      return {
        strengths:       ['Attempted all questions'],
        weaknesses:      ['Could not generate detailed analysis'],
        recommendations: ['Review data structures and algorithms'],
      };
    }
  }
}

// ================================================================
// MOCK MODE
// ================================================================
import mockAIService from './mock.ai.service';
const isMockMode = process.env.MOCK_AI === 'true';
if (isMockMode) console.log('🟡 MOCK_AI mode enabled — all AI calls are disabled.');
export default isMockMode ? mockAIService : new AIService();