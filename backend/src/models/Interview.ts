import mongoose, { Schema, Document } from 'mongoose';

export interface VerbatimEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

export interface IInterview extends Document {
  userId: string;
  sessionId: string;
  date: Date;
  score: number;
  feedback: string;
  verbatim: VerbatimEntry[];
  improvements: string[];
  verdict?: string;
}

const VerbatimSchema = new Schema<VerbatimEntry>(
  {
    role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const InterviewSchema = new Schema<IInterview>({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  date: { type: Date, default: Date.now },
  score: { type: Number, required: true, min: 0, max: 100 },
  feedback: { type: String, required: true },
  verbatim: { type: [VerbatimSchema], default: [] },
  improvements: { type: [String], default: [] },
  verdict: { type: String },
});

export default mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);