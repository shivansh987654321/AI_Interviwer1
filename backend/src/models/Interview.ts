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
  cheatingFlags?: string[];
  tabSwitches?: number;
}

const InterviewSchema: Schema = new Schema(
  {
    userId:             { type: String, required: true, index: true },
    sessionId:          { type: String, required: true, unique: true, index: true },
    date:               { type: Date, default: Date.now },
    score:              { type: Number, required: true },
    feedback:           { type: String, required: true },
    verbatim:           [{ role: { type: String }, content: { type: String }, _id: false }],
    improvements:       [{ type: String }],
    verdict:            { type: String, default: 'Pending' },
    difficulty:         { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    questionsAttempted: { type: Number, default: 0 },
    cheatingFlags:      [{ type: String }],
    tabSwitches:        { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient history queries (sorted by date)
InterviewSchema.index({ userId: 1, date: -1 });

export default mongoose.models.Interview ||
  mongoose.model<IInterview>('Interview', InterviewSchema);