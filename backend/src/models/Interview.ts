import mongoose, { Schema, Document } from 'mongoose';

export interface IInterview extends Document {
  userId: string;
  sessionId: string;
  date: Date;
  score: number;
  feedback: string;
  verbatim: { role: string; content: string }[];
  improvements: string[];
  verdict: string;
  difficulty?: string;
  questionsAttempted?: number;
}

const InterviewSchema: Schema = new Schema(
  {
    userId:             { type: String, required: true, index: true },
    sessionId:          { type: String, required: true, unique: true, index: true },
    date:               { type: Date, default: Date.now },
    score:              { type: Number, required: true },
    feedback:           { type: String, required: true },
    verbatim:           { type: Array, default: [] },
    improvements:       { type: Array, default: [] },
    verdict:            { type: String, default: 'Pending' },
    difficulty:         { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    questionsAttempted: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Interview ||
  mongoose.model<IInterview>('Interview', InterviewSchema);