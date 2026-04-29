import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const execAsync = promisify(exec);
import dotenv from 'dotenv';
import { DSAQuestion, DSATestCase, EvaluationResult, StarterCode, TestCaseResult } from '../types/interview.types';
import { QuestionMeta } from '../data/question-bank';

dotenv.config();

// ================================================================
// LOCAL CODE EXECUTION — spawns node/python3/java/g++ as child processes
// No external API needed — works on any server
// ================================================================
const CODE_EXT: Record<string, string> = {
  javascript: 'js',
  python:     'py',
  java:       'java',
  cpp:        'cpp',
};

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
// SEMAPHORE — limits concurrent AI chat calls to prevent API overload
// ================================================================
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];
  constructor(permits: number) { this.permits = permits; }
  acquire(): Promise<void> {
    if (this.permits > 0) { this.permits--; return Promise.resolve(); }
    return new Promise(resolve => this.queue.push(resolve));
  }
  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.permits++;
  }
}
const aiSemaphore = new Semaphore(5); // max 5 concurrent AI chat calls

// ================================================================
// FALLBACK QUESTION & STARTER CODE (used when AI generation fails)
// ================================================================
const FALLBACK_STARTER = {
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
const n = parseInt(lines[0]);
const nums = lines[1].split(' ').map(Number);
const target = parseInt(lines[2]);

// ─── YOUR SOLUTION ───────────────────────────────────────────────
function twoSum(nums, target) {
  // Write your solution here

}
// ─────────────────────────────────────────────────────────────────

const result = twoSum(nums, target);
console.log(result.join(' '));`,

  python: `import sys
lines = sys.stdin.read().strip().split('\\n')
n = int(lines[0])
nums = list(map(int, lines[1].split()))
target = int(lines[2])

# ─── YOUR SOLUTION ───────────────────────────────────────────────
def twoSum(nums, target):
    # Write your solution here
    pass
# ─────────────────────────────────────────────────────────────────

result = twoSum(nums, target)
print(' '.join(map(str, result)))`,

  java: `import java.util.*;
class Main {
    // ─── YOUR SOLUTION ───────────────────────────────────────────────
    static int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
    // ─────────────────────────────────────────────────────────────────

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        int[] res = twoSum(nums, target);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < res.length; i++) { if (i > 0) sb.append(' '); sb.append(res[i]); }
        System.out.println(sb);
    }
}`,

  cpp: `#include<bits/stdc++.h>
using namespace std;
// ─── YOUR SOLUTION ───────────────────────────────────────────────
vector<int> twoSum(vector<int>& nums, int target) {
    // Write your solution here
    return {};
}
// ─────────────────────────────────────────────────────────────────

int main(){
    int n; cin >> n;
    vector<int> nums(n);
    for (int& x : nums) cin >> x;
    int target; cin >> target;
    vector<int> res = twoSum(nums, target);
    for (int i = 0; i < (int)res.size(); i++) { if(i) cout << ' '; cout << res[i]; }
    cout << endl;
    return 0;
}`,
};

const FALLBACK_POOL: Omit<DSAQuestion, 'difficulty'>[] = [
  {
    title: 'Two Sum',
    description: `Given an array of integers and a target, return the indices of the two numbers that add up to target.\n\nInput:\n- Line 1: n (array size)\n- Line 2: n space-separated integers\n- Line 3: target\n\nOutput: two space-separated 0-based indices\n\nExample:\nInput: 4 / 2 7 11 15 / 9\nOutput: 0 1`,
    constraints: ['2 <= n <= 10^4', 'Exactly one valid answer'],
    functionSignature: 'int[] twoSum(int[] nums, int target)',
    testCases: [
      { input: 'nums=[2,7,11,15], target=9', output: '[0,1]', stdin: '4\n2 7 11 15\n9', expectedOutput: '0 1' },
      { input: 'nums=[3,2,4], target=6',     output: '[1,2]', stdin: '3\n3 2 4\n6',     expectedOutput: '1 2' },
      { input: 'nums=[3,3], target=6',       output: '[0,1]', stdin: '2\n3 3\n6',       expectedOutput: '0 1' },
    ],
    starterCode: FALLBACK_STARTER as StarterCode,
  },
  {
    title: 'Valid Parentheses',
    description: `Given a string containing only '(', ')', '{', '}', '[', ']', determine if it is valid.\n\nA string is valid if:\n- Open brackets are closed by the same type\n- Open brackets are closed in correct order\n\nInput: one line with the string\nOutput: true or false\n\nExample:\nInput: ()[]{}\nOutput: true`,
    constraints: ['1 <= s.length <= 10^4', "s consists of '()[]{}'"],
    functionSignature: 'boolean isValid(String s)',
    testCases: [
      { input: 's="()[]{}"', output: 'true',  stdin: '()[]{}\n', expectedOutput: 'true' },
      { input: 's="([)]"',   output: 'false', stdin: '([)]\n',   expectedOutput: 'false' },
      { input: 's="{[]}"',   output: 'true',  stdin: '{[]}\n',   expectedOutput: 'true' },
    ],
    starterCode: {
      javascript: `const line = require('fs').readFileSync('/dev/stdin','utf8').trim();\n\nfunction isValid(s) {\n  // write your solution here\n}\n\nconsole.log(isValid(line));`,
      python:     `s = input().strip()\n\ndef is_valid(s):\n    # write your solution here\n    pass\n\nprint(str(is_valid(s)).lower())`,
      java:       `import java.util.*;\nclass Main {\n    static boolean isValid(String s) {\n        // write your solution here\n        return false;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println(isValid(sc.nextLine().trim()));\n    }\n}`,
      cpp:        `#include<bits/stdc++.h>\nusing namespace std;\nbool isValid(string s) {\n    // write your solution here\n    return false;\n}\nint main(){\n    string s; cin >> s;\n    cout << (isValid(s) ? "true" : "false") << endl;\n    return 0;\n}`,
    },
  },
  {
    title: 'Climbing Stairs',
    description: `You are climbing a staircase with n steps. Each time you can climb 1 or 2 steps. How many distinct ways can you climb to the top?\n\nInput: one integer n\nOutput: number of distinct ways\n\nExample:\nInput: 3\nOutput: 3`,
    constraints: ['1 <= n <= 45'],
    functionSignature: 'int climbStairs(int n)',
    testCases: [
      { input: 'n=2', output: '2', stdin: '2\n', expectedOutput: '2' },
      { input: 'n=3', output: '3', stdin: '3\n', expectedOutput: '3' },
      { input: 'n=5', output: '8', stdin: '5\n', expectedOutput: '8' },
    ],
    starterCode: {
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n\nfunction climbStairs(n) {\n  // write your solution here\n}\n\nconsole.log(climbStairs(n));`,
      python:     `n = int(input())\n\ndef climb_stairs(n):\n    # write your solution here\n    pass\n\nprint(climb_stairs(n))`,
      java:       `import java.util.*;\nclass Main {\n    static int climbStairs(int n) {\n        // write your solution here\n        return 0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println(climbStairs(sc.nextInt()));\n    }\n}`,
      cpp:        `#include<bits/stdc++.h>\nusing namespace std;\nint climbStairs(int n) {\n    // write your solution here\n    return 0;\n}\nint main(){\n    int n; cin >> n;\n    cout << climbStairs(n) << endl;\n    return 0;\n}`,
    },
  },
  {
    title: 'Contains Duplicate',
    description: `Given an integer array, return true if any value appears at least twice, false if every element is distinct.\n\nInput:\n- Line 1: n (array size)\n- Line 2: n space-separated integers\n\nOutput: true or false\n\nExample:\nInput: 4 / 1 2 3 1\nOutput: true`,
    constraints: ['1 <= n <= 10^5'],
    functionSignature: 'boolean containsDuplicate(int[] nums)',
    testCases: [
      { input: 'nums=[1,2,3,1]',    output: 'true',  stdin: '4\n1 2 3 1\n',    expectedOutput: 'true' },
      { input: 'nums=[1,2,3,4]',    output: 'false', stdin: '4\n1 2 3 4\n',    expectedOutput: 'false' },
      { input: 'nums=[1,1,1,3,3]',  output: 'true',  stdin: '5\n1 1 1 3 3\n',  expectedOutput: 'true' },
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst nums = lines[1].split(' ').map(Number);\n\nfunction containsDuplicate(nums) {\n  // write your solution here\n}\n\nconsole.log(containsDuplicate(nums));`,
      python:     `import sys\nlines = sys.stdin.read().strip().split('\\n')\nnums = list(map(int, lines[1].split()))\n\ndef contains_duplicate(nums):\n    # write your solution here\n    pass\n\nprint(str(contains_duplicate(nums)).lower())`,
      java:       `import java.util.*;\nclass Main {\n    static boolean containsDuplicate(int[] nums) {\n        // write your solution here\n        return false;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n        System.out.println(containsDuplicate(nums));\n    }\n}`,
      cpp:        `#include<bits/stdc++.h>\nusing namespace std;\nbool containsDuplicate(vector<int>& nums) {\n    // write your solution here\n    return false;\n}\nint main(){\n    int n; cin >> n;\n    vector<int> nums(n);\n    for(int& x : nums) cin >> x;\n    cout << (containsDuplicate(nums) ? "true" : "false") << endl;\n    return 0;\n}`,
    },
  },
];

let _fallbackIndex = Math.floor(Math.random() * FALLBACK_POOL.length);

function FALLBACK_QUESTION(level: string): DSAQuestion {
  // Rotate through fallback pool so repeated failures don't always give the same problem
  const q = FALLBACK_POOL[_fallbackIndex % FALLBACK_POOL.length];
  _fallbackIndex++;
  return { ...q, difficulty: level };
}

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
  // INTERNAL: rate-limited chat completion
  // Acquires semaphore slot before calling the API — prevents thundering-herd
  // ================================================================
  private async chatComplete(
    params: Parameters<typeof this.chatClient.chat.completions.create>[0]
  ): Promise<import('openai/resources').ChatCompletion> {
    await aiSemaphore.acquire();
    try {
      return this.chatClient.chat.completions.create(params) as Promise<import('openai/resources').ChatCompletion>;
    } finally {
      aiSemaphore.release();
    }
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

      // 2. Convert webm→mp3 using system ffmpeg (available on Linux/Render/macOS).
      // Groq Whisper rejects raw browser WebM; converting fixes corrupt duration headers.
      await execAsync(`ffmpeg -y -i "${tempInPath}" -ar 16000 -ac 1 -b:a 64k "${tempOutPath}"`);

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
  // LOCAL CODE EXECUTION — spawns language runtimes as child processes
  // ================================================================
  async executeCode(
    code: string,
    language: string,
    stdin: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; compileError: string }> {
    const id      = randomUUID();
    const ext     = CODE_EXT[language] ?? 'js';
    const TIMEOUT = 8000; // 8 s wall time

    // Each execution gets its own temp directory — prevents Java class file conflicts
    const jobDir = path.join(os.tmpdir(), `job_${id}`);
    fs.mkdirSync(jobDir, { recursive: true });

    // Java filename must match the public class name — always "Main"
    const fileName = language === 'java' ? 'Main.java' : `code_${id}.${ext}`;
    const filePath  = path.join(jobDir, fileName);
    const stdinFile = path.join(jobDir, 'stdin.txt');

    fs.writeFileSync(filePath, code, 'utf8');
    fs.writeFileSync(stdinFile, stdin, 'utf8');

    let runCmd: string;
    let compileCmd: string | null = null;
    let compiledBin: string | null = null;

    switch (language) {
      case 'python':
        runCmd = `python3 "${filePath}" < "${stdinFile}"`;
        break;
      case 'java':
        compileCmd = `javac -cp "${jobDir}" "${filePath}"`;
        runCmd     = `java -cp "${jobDir}" Main < "${stdinFile}"`;
        break;
      case 'cpp': {
        compiledBin = path.join(jobDir, 'prog');
        compileCmd  = `g++ -o "${compiledBin}" "${filePath}"`;
        runCmd      = `"${compiledBin}" < "${stdinFile}"`;
        break;
      }
      default: // javascript
        runCmd = `node "${filePath}" < "${stdinFile}"`;
    }

    const cleanup = () => {
      try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch { /* ignore */ }
    };

    try {
      // Compile step (Java / C++)
      if (compileCmd) {
        try {
          await execAsync(compileCmd, { timeout: TIMEOUT });
        } catch (e: unknown) {
          cleanup();
          const msg = e instanceof Error ? e.message : String(e);
          return { stdout: '', stderr: '', exitCode: 1, compileError: msg };
        }
      }

      // Run step
      const { stdout, stderr } = await execAsync(runCmd, { timeout: TIMEOUT });
      cleanup();
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, compileError: '' };
    } catch (e: unknown) {
      cleanup();
      const err = e as { stdout?: string; stderr?: string; killed?: boolean; code?: number };
      if (err.killed) {
        return { stdout: '', stderr: 'Time Limit Exceeded', exitCode: 124, compileError: '' };
      }
      return {
        stdout:       (err.stdout ?? '').trim(),
        stderr:       (err.stderr ?? String(e)).trim(),
        exitCode:     err.code ?? 1,
        compileError: '',
      };
    }
  }

  // Runs code against all provided test cases locally
  async runTestCases(
    code:      string,
    language:  string,
    testCases: DSATestCase[],
  ): Promise<TestCaseResult[]> {
    const executable = testCases.filter(tc => tc.stdin !== undefined && tc.expectedOutput !== undefined);

    const rawResults = await Promise.all(
      executable.map(tc => this.executeCode(code, language, tc.stdin!).catch((e) => ({ error: String(e) }))),
    );

    return executable.map((tc, i) => {
      const r = rawResults[i] as { stdout?: string; stderr?: string; exitCode?: number; compileError?: string; error?: string };

      if (r.error) {
        return { input: tc.input, expectedOutput: tc.expectedOutput ?? tc.output, actualOutput: r.error, passed: false, status: 'Error' };
      }

      const expected = (tc.expectedOutput ?? '').trim();
      let actualOutput: string;
      let status: string;

      if (r.compileError) {
        actualOutput = r.compileError;
        status = 'Compilation Error';
      } else if ((r.exitCode ?? 0) !== 0 && (r.stderr?.includes('Time Limit') || r.exitCode === 124)) {
        actualOutput = 'Time Limit Exceeded';
        status = 'Time Limit Exceeded';
      } else if ((r.exitCode ?? 0) !== 0) {
        actualOutput = r.stderr || 'Runtime Error';
        status = 'Runtime Error';
      } else {
        actualOutput = r.stdout ?? '';
        status = actualOutput === expected ? 'Accepted' : 'Wrong Answer';
      }

      return {
        input:          tc.input,
        expectedOutput: expected,
        actualOutput,
        passed:         status === 'Accepted',
        status,
        time:   null,
        memory: null,
      };
    });
  }

  // ================================================================
  // DSA QUESTION GENERATION
  // ================================================================
  async generateDSAQuestion(level: string, meta?: QuestionMeta): Promise<DSAQuestion> {
    const difficultyGuide: Record<string, string> = {
      easy:   'easy to medium level (arrays, strings, hashmaps, two-pointers — solvable in 15-20 min)',
      medium: 'medium level (trees, sliding window, BFS/DFS, sorting — solvable in 25-30 min)',
      hard:   'medium-hard to hard level (DP, graphs, backtracking, advanced data structures — solvable in 40-50 min)',
    };
    const diffDesc = difficultyGuide[level] ?? `${level}-level`;

    const problemSpec = meta
      ? `Generate the well-known LeetCode problem "${meta.title}" (topic: ${meta.topic}, URL: ${meta.url}).`
      : `Generate a unique ${diffDesc} DSA coding problem for a technical interview.`;

    const prompt = `${problemSpec}

REQUIREMENTS:
1. testCases: include both human-readable AND machine stdin/expectedOutput formats (3 cases, last one an edge case)
2. starterCode: boilerplate-only template for each language — DO NOT implement the solution
   - The I/O parsing code (reading stdin, printing stdout) must be COMPLETE and CORRECT
   - The solution function body must contain ONLY the comment "// write your solution here" — NO algorithm, NO logic, NO hints
   - The candidate writes the solution; you write everything else
   - stdout output must match expectedOutput exactly (trimmed, no trailing whitespace)
3. stdin format must be consistent across testCases and starterCode

⚠️ STRICT RULE: DO NOT write the solution algorithm. The function body must be empty except for one comment.

Return STRICT JSON only — no markdown:
{
  "title": "Problem title",
  "description": "Clear problem statement with Input/Output format and 1-2 worked examples",
  "difficulty": "${level}",
  "constraints": ["constraint 1", "constraint 2"],
  "functionSignature": "e.g. int[] twoSum(int[] nums, int target)",
  "testCases": [
    { "input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "stdin": "4\\n2 7 11 15\\n9", "expectedOutput": "0 1" },
    { "input": "nums = [3,2,4], target = 6", "output": "[1,2]", "stdin": "3\\n3 2 4\\n6", "expectedOutput": "1 2" },
    { "input": "nums = [3,3], target = 6", "output": "[0,1]", "stdin": "2\\n3 3\\n6", "expectedOutput": "0 1" }
  ],
  "starterCode": {
    "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\\\n');\\n// TODO: parse input from lines\\n\\nfunction solve(/* args */) {\\n  // write your solution here\\n}\\n\\n// TODO: call solve() and print the result",
    "python": "import sys\\nlines = sys.stdin.read().strip().split('\\\\n')\\n# TODO: parse input\\n\\ndef solve(# args):\\n    # write your solution here\\n    pass\\n\\n# TODO: call solve() and print the result",
    "java": "import java.util.*;\\nclass Main {\\n    static /* return type */ solve(/* params */) {\\n        // write your solution here\\n        return /* default */;\\n    }\\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        // TODO: parse input, call solve(), print result\\n    }\\n}",
    "cpp": "#include<bits/stdc++.h>\\nusing namespace std;\\n/* return type */ solve(/* params */) {\\n    // write your solution here\\n    return /* default */;\\n}\\nint main(){\\n    // TODO: parse input, call solve(), print result\\n    return 0;\\n}"
  }
}`;

    try {
      const completion = await this.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.7,
        max_tokens: 4500,
        response_format: { type: 'json_object' },
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      const question = this.cleanAndParse(rawText);
      if (!question) throw new Error('Parsed JSON was null');

      const rawTestCases = Array.isArray(question.testCases) ? question.testCases as Record<string, string>[] : [];
      const testCases: DSATestCase[] = rawTestCases.map(tc => ({
        input:          this.str(tc.input,          ''),
        output:         this.str(tc.output,         ''),
        stdin:          tc.stdin          ? this.str(tc.stdin,          undefined) : undefined,
        expectedOutput: tc.expectedOutput ? this.str(tc.expectedOutput, undefined) : undefined,
      }));

      const rawStarter = question.starterCode as Record<string, string> | undefined;
      const starterCode: StarterCode | undefined = rawStarter ? {
        javascript: this.str(rawStarter.javascript, FALLBACK_STARTER.javascript),
        python:     this.str(rawStarter.python,     FALLBACK_STARTER.python),
        java:       this.str(rawStarter.java,       FALLBACK_STARTER.java),
        cpp:        this.str(rawStarter.cpp,        FALLBACK_STARTER.cpp),
      } : undefined;

      return {
        title:             this.str(question.title,             'Unknown Problem'),
        description:       this.str(question.description,       'No description provided.'),
        difficulty:        this.str(question.difficulty,        level),
        testCases,
        constraints:       this.strArr(question.constraints),
        functionSignature: this.str(question.functionSignature, 'function solution() {'),
        starterCode,
      };
    } catch (err) {
      console.error('❌ Question Gen Error (using fallback):', err);
      return FALLBACK_QUESTION(level);
    }
  }

  // ================================================================
  // CODE EVALUATION — Piston real execution, AI feedback fallback
  // ================================================================
  async evaluateCode(
    question: DSAQuestion,
    code: string,
    language: string,
  ): Promise<EvaluationResult> {
    const executableCases = question.testCases.filter(tc => tc.stdin !== undefined);

    // --- Piston path (always available, no API key required) ---
    if (executableCases.length > 0) {
      try {
        const testCaseResults = await this.runTestCases(code, language, question.testCases);
        const passed  = testCaseResults.filter(r => r.passed).length;
        const total   = testCaseResults.length || 1;
        const score   = Math.round((passed / total) * 100);

        const hasCompileErr = testCaseResults.some(r => r.status === 'Compilation Error');
        const hasTLE        = testCaseResults.some(r => r.status === 'Time Limit Exceeded');
        const hasRTE        = testCaseResults.some(r => r.status?.startsWith('Runtime'));

        const verdict: EvaluationResult['verdict'] =
          passed === total    ? 'Accepted'             :
          hasCompileErr       ? 'Compilation Error'    :
          hasTLE              ? 'Time Limit Exceeded'  :
          hasRTE              ? 'Runtime Error'        : 'Wrong Answer';

        const feedback = await this.getCodeFeedback(question, code, language, score, verdict, testCaseResults);

        return { score, verdict, feedback, improvements: [], testCases: testCaseResults };
      } catch (err) {
        console.error('❌ Piston evaluation failed — falling back to AI:', err);
      }
    }

    // --- AI fallback (question has no stdin test cases) ---
    return this.evaluateCodeWithAI(question, code, language);
  }

  // AI-only evaluation (fallback when Judge0 is unavailable)
  private async evaluateCodeWithAI(
    question: DSAQuestion,
    code: string,
    language: string,
  ): Promise<EvaluationResult> {
    const prompt = `You are a senior software engineer evaluating a candidate's code submission.

Problem: ${question.title}
Description: ${question.description}
Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`

Return STRICT JSON only:
{
  "score": <0-100>,
  "verdict": "<Accepted|Wrong Answer|Compilation Error|Time Limit Exceeded|Runtime Error>",
  "feedback": "<one paragraph>",
  "improvements": ["suggestion 1", "suggestion 2"]
}

Scoring: 90-100 perfect, 70-89 correct but suboptimal, 50-69 partially correct, 0-49 wrong.`;

    try {
      const completion = await this.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat, temperature: 0.2, max_tokens: 600,
        response_format: { type: 'json_object' },
      });
      const result = this.cleanAndParse(completion.choices[0]?.message?.content || '{}');
      if (!result) throw new Error('null');
      return {
        score:        typeof result.score === 'number' ? result.score : 0,
        verdict:      this.str(result.verdict, 'Wrong Answer') as EvaluationResult['verdict'],
        feedback:     this.str(result.feedback, 'Could not evaluate.'),
        improvements: this.strArr(result.improvements),
      };
    } catch (err) {
      console.error('❌ AI Code Evaluation Error:', err);
      return { score: 0, verdict: 'Wrong Answer', feedback: 'Could not evaluate. Please try again.', improvements: [] };
    }
  }

  // Generates brief AI feedback given Judge0 results
  private async getCodeFeedback(
    question: DSAQuestion,
    code: string,
    language: string,
    score: number,
    verdict: string,
    results?: TestCaseResult[],
  ): Promise<string> {
    const failedCases = results?.filter(r => !r.passed).slice(0, 2) ?? [];
    const failSummary = failedCases.length
      ? `Failed cases: ${failedCases.map(r => `input="${r.input}" expected="${r.expectedOutput}" got="${r.actualOutput}"`).join('; ')}`
      : '';

    const prompt = `Problem: ${question.title}
Verdict: ${verdict} (score ${score}/100). ${failSummary}
Language: ${language}
Code (first 800 chars): ${code.substring(0, 800)}

Write 1-2 sentences of feedback for the candidate. Be specific and constructive. No markdown.`;

    try {
      const completion = await this.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat, temperature: 0.3, max_tokens: 150,
      });
      return completion.choices[0]?.message?.content?.trim() || (verdict === 'Accepted' ? 'Great solution!' : 'Review your logic against the failing test cases.');
    } catch {
      return verdict === 'Accepted' ? 'All test cases passed!' : 'Check your solution against the failing test cases.';
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
      const completion = await this.chatComplete({
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
    // Trim history to last 20 turns to stay within token budget
    const trimmedHistory = chatHistory.slice(-20);
    const historyText = trimmedHistory
      .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
      .join('\n');

    const codingText = codingResult
      ? `Score: ${codingResult.score ?? 'N/A'}/100, Verdict: ${codingResult.verdict ?? 'N/A'}, Feedback: ${codingResult.feedback ?? 'N/A'}`
      : 'Candidate did not reach the coding round or no submission was made.';

    const prompt = `You are evaluating a completed technical interview. Score the candidate honestly across three dimensions.

=== VERBAL INTERVIEW TRANSCRIPT ===
${historyText}

=== CODING RESULT ===
${codingText}

=== SCORING RUBRIC ===
communication (0-30): Clarity, structure, confidence, how well they articulate ideas
technical (0-40): Depth of CS knowledge shown — OS, DBMS, algorithms, data structures, system design
problem_solving (0-30): Coding score + how they approached problems logically

Total score = communication + technical + problem_solving (max 100)

Return STRICT JSON only — no markdown, no extra text:
{
  "score": <total 0-100>,
  "breakdown": {
    "communication": <0-30>,
    "technical": <0-40>,
    "problem_solving": <0-30>
  },
  "feedback_summary": "2-3 sentence honest summary of overall performance",
  "key_strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "areas_for_improvement": ["specific area 1", "specific area 2"]
}`;

    try {
      const completion = await this.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
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
      const completion = await this.chatComplete({
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