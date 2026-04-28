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

export interface StarterCode {
  javascript: string;
  python: string;
  java: string;
  cpp: string;
}

export interface DSATestCase {
  input: string;           // human-readable display
  output: string;          // human-readable display
  stdin?: string;          // actual stdin for Judge0
  expectedOutput?: string; // actual expected stdout for Judge0
}

export interface DSAQuestion {
  title: string;
  description: string;
  difficulty: string;
  constraints: string[];
  testCases: DSATestCase[];
  functionSignature: string;
  starterCode?: StarterCode;
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
   DETAILED REPORT (Professional Format)
========================= */

export interface CategoryScore {
  score: number;         // out of 10
  clarity?: string;
  structure?: string;
  fluency?: string;
  key_issue?: string;
  concept_accuracy?: string;
  depth?: string;
  mistakes?: string;
  approach?: string;
  logical_thinking?: string;
  edge_cases?: string;
  optimization?: string;
  hesitation?: string;
  stability?: string;
  pressure_handling?: string;
}

export interface QuestionBreakdown {
  question: string;
  score: number;         // out of 10
  went_right: string;
  went_wrong: string;
  depth_level: 'Surface' | 'Moderate' | 'Deep';
}

export interface BehavioralAnalysis {
  avg_response_time: string;
  hesitation_level: string;
  filler_word_usage: string;
  communication_pattern: string;
  insight: string;
}

export interface ThinkingStyle {
  structured_vs_unstructured: string;
  memorization_vs_understanding: string;
  problem_solving_maturity: string;
}

export interface ImprovementPlan {
  what_to_study: string[];
  what_to_practice: string[];
  how_to_improve: string[];
  timeline: string;
}

export interface DetailedReport {
  // Summary
  summary: string;
  overall_score: number;   // out of 10
  verdict: 'Strong Hire' | 'Hire' | 'Borderline' | 'Reject';
  verdict_justification: string;

  // Category scores
  communication: CategoryScore;
  technical_knowledge: CategoryScore;
  problem_solving: CategoryScore;
  confidence: CategoryScore;

  // Breakdown
  question_breakdown: QuestionBreakdown[];
  behavioral_analysis: BehavioralAnalysis;

  // Lists
  critical_mistakes: string[];
  improvement_areas: string[];
  proven_strengths: string[];

  // Analysis
  thinking_style: ThinkingStyle;
  improvement_plan: ImprovementPlan;
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
  status?: string;
  time?: string | null;
  memory?: number | null;
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