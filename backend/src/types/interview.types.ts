/* =========================
   ENUMS
========================= */

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

/* =========================
   QUESTION
========================= */

export interface DSAQuestion {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  example: {
    input: string;
    output: string;
    explanation?: string;
  };
  starterCode: string;

  // Metadata
  generationId?: string;
  generatedBy?: string;
  generatedAt?: string;
}

/* =========================
   INTERVIEW SESSION (Single Question)
========================= */

export interface DSASession {
  id: string;
  difficulty: Difficulty;
  question: DSAQuestion;
  startTime: Date;
  timeLimit: number;
  code?: string;
  language?: string;
  evaluation?: EvaluationResult;
  createdAt: Date;
}

/* =========================
   REPORT & SCORING (The Missing Parts)
========================= */

export interface Score {
  questionId?: string;
  score: number;
  maxScore: number;
  feedback: string;
  verdict: string;
}

// This is the session type your ReportService expects
export interface InterviewSession {
  id: string;
  userId?: string;
  scores: Score[]; // Array of scores for the report
  createdAt: Date;
}

export interface InterviewReport {
  sessionId: string;
  overallScore: number;
  maxScore: number;
  percentage: number;
  scores: Score[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedAt: Date;
}

/* =========================
   API REQUESTS
========================= */

export interface CreateInterviewRequest {
  difficulty: Difficulty;
}

export interface SubmitCodeRequest {
  sessionId: string;
  code: string;
  language: string;
}

/* =========================
   EVALUATION
========================= */

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface EvaluationResult {
  score: number;
  verdict:
    | 'Accepted'
    | 'Wrong Answer'
    | 'Compilation Error'
    | 'Time Limit Exceeded'
    | 'Runtime Error';

  feedback: string;
  improvements: string[];
  testCases?: TestCaseResult[];
}