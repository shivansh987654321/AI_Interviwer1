import mongoose, { Schema, Document } from 'mongoose';

export interface IInterview extends Document {
  userId: string;          // From Clerk (we'll get this later)
  sessionId: string;
  date: Date;
  score: number;
  feedback: string;
  verbatim: { role: string; content: string }[]; // Full chat history
  improvements: string[];
  verdict: string;
}
const InterviewSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true }, // 🆕 ADD THIS LINE
  date: { type: Date, default: Date.now },
  score: { type: Number, required: true },
  feedback: { type: String, required: true },
  verbatim: { type: Array, default: [] },
  // Optional fields for better reports
  improvements: { type: Array, default: [] },
  verdict: { type: String }
});

// Check if model exists before creating (prevents overwrite errors)
export default mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);