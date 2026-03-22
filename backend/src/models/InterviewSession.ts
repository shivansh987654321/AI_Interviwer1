import mongoose, { Schema, Document } from 'mongoose';

export interface TestCase {
  input: string;
  output: string;
}

export interface DSAQuestionDoc {
  title: string;
  description: string;
  difficulty: string;
  constraints: string[];
  testCases: TestCase[];
  functionSignature: string;
}

export interface ScoreEntry {
  score: number;
  verdict: string;
  code: string;
  questionTitle: string;
}

export interface IInterviewSession extends Document {
  sessionId: string;
  questions: DSAQuestionDoc[];
  currentQuestionIndex: number;
  question: DSAQuestionDoc;
  scores: ScoreEntry[];
  status: 'active' | 'completed';
  duration: number;
  startTime: Date;
  createdAt: Date;
}

const TestCaseSchema = new Schema<TestCase>(
  { input: { type: String, required: true }, output: { type: String, required: true } },
  { _id: false }
);

const DSAQuestionDocSchema = new Schema<DSAQuestionDoc>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, required: true },
    constraints: { type: [String], default: [] },
    testCases: { type: [TestCaseSchema], default: [] },
    functionSignature: { type: String, required: true },
  },
  { _id: false }
);

const ScoreEntrySchema = new Schema<ScoreEntry>(
  {
    score: { type: Number, required: true },
    verdict: { type: String, required: true },
    code: { type: String, required: true },
    questionTitle: { type: String, required: true },
  },
  { _id: false }
);

const InterviewSessionSchema = new Schema<IInterviewSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  questions: { type: [DSAQuestionDocSchema], required: true },
  currentQuestionIndex: { type: Number, default: 0 },
  question: { type: DSAQuestionDocSchema, required: true },
  scores: { type: [ScoreEntrySchema], default: [] },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  duration: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.InterviewSession ||
  mongoose.model<IInterviewSession>('InterviewSession', InterviewSessionSchema);
