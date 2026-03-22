import { Server, Socket } from 'socket.io';
import geminiService, { HistoryEntry } from '../services/gemini.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';

// --- DEFINITIONS ---
type Phase = 'intro' | 'verbal' | 'coding' | 'completed';

interface SessionState {
  history: HistoryEntry[];
  phase: Phase;
  codingResult?: unknown;
  codingTimer?: ReturnType<typeof setTimeout>;
}

const MAX_HISTORY_MESSAGES = 12;

// Store active sessions in memory
const activeSessions = new Map<string, SessionState>();

function appendHistory(history: HistoryEntry[], entry: HistoryEntry): void {
  history.push(entry);
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }
}

export const initializeInterviewSocket = (io: Server) => {
  const interviewNamespace = io.of('/');

  interviewNamespace.on('connection', (socket: Socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 Client connected: ${socket.id}`);
    }

    // --- 1. START/JOIN SESSION ---
    socket.on('start_voice_interview', async (data: { sessionId?: string }) => {
      const sessionId = data?.sessionId;
      if (!sessionId) return;

      socket.join(sessionId);

      if (!activeSessions.has(sessionId)) {
        activeSessions.set(sessionId, { history: [], phase: 'intro' });

        try {
          const aiResponse = await geminiService.generateVerbalResponse([], 'START_INTERVIEW');
          const state = activeSessions.get(sessionId)!;
          appendHistory(state.history, { role: 'assistant', content: aiResponse.text });
          socket.emit('ai_speak', { text: aiResponse.text });
        } catch (e) {
          console.error('AI Init Error:', e);
          socket.emit('ai_speak', { text: 'Hello. I am ready to begin your interview.' });
        }
      }
    });

    // --- 2. VERBAL CONVERSATION ---
    socket.on('user_speak', async (data: { text?: string; sessionId?: string }) => {
      const { text, sessionId } = data;
      if (!sessionId || !text) return;

      const state = activeSessions.get(sessionId);
      if (!state) {
        socket.emit('interview_error', { message: 'Session not found. Please refresh and try again.' });
        return;
      }

      appendHistory(state.history, { role: 'user', content: text });

      try {
        const aiResponse = await geminiService.generateVerbalResponse(state.history, text);
        appendHistory(state.history, { role: 'assistant', content: aiResponse.text });
        socket.emit('ai_speak', { text: aiResponse.text });

        if (aiResponse.action === 'START_CODING' && state.phase !== 'coding') {
          state.phase = 'coding';

          if (state.codingTimer) clearTimeout(state.codingTimer);
          state.codingTimer = setTimeout(() => {
            const latest = activeSessions.get(sessionId);
            if (latest?.phase === 'coding') {
              io.to(sessionId).emit('start_coding_phase');
            }
          }, 1500);
        }
      } catch (e) {
        console.error('AI Response Error:', e);
        socket.emit('interview_error', {
          message: 'The interview service temporarily failed. Please try again.',
        });
      }
    });

    // --- 3. SAVE CODING RESULT ---
    socket.on('submit_code_result', (data: { sessionId?: string; result?: unknown }) => {
      const { sessionId, result } = data;
      if (!sessionId) return;
      const state = activeSessions.get(sessionId);
      if (state) {
        state.codingResult = result;
      }
    });

    // --- 4. END INTERVIEW & GENERATE REPORT ---
    socket.on('end_interview', async (data: { sessionId?: string; userId?: string }) => {
      const { sessionId, userId } = data;
      if (!sessionId) return;

      const state = activeSessions.get(sessionId);
      if (!state) {
        socket.emit('interview_error', { message: 'Session data not found.' });
        return;
      }

      try {
        socket.emit('feedback_processing', { message: 'Analyzing performance...' });

        const report = await geminiService.generateFinalFeedback(state.history, state.codingResult);

        try {
          await connectToDatabase();

          const newInterview = await Interview.create({
            userId: userId || 'GUEST_USER',
            sessionId,
            score: report.score,
            feedback: report.feedback_summary,
            verbatim: state.history,
            improvements: report.areas_for_improvement ?? [],
            verdict: report.score >= 70 ? 'Passed' : 'Needs Improvement',
            date: new Date(),
          });

          if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Saved to DB with ID: ${newInterview._id}`);
          }

          socket.emit('interview_results', { success: true, sessionId, ...report });

          if (state.codingTimer) clearTimeout(state.codingTimer);
          activeSessions.delete(sessionId);
        } catch (dbError) {
          console.error('❌ Database Save Failed:', dbError);
          socket.emit('interview_error', { message: 'Failed to save results to database.' });
        }
      } catch (error) {
        console.error('Report Generation Error:', error);
        socket.emit('interview_error', {
          message: 'Unable to generate your report. Please try finishing the interview again or contact support if the issue persists.',
        });
      }
    });

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      }
    });
  });
};