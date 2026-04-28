import { Server, Socket } from 'socket.io';
import aiService from '../services/ai.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';

// --- DEFINITIONS ---
type DifficultyLevel = 'warmup' | 'easy' | 'medium' | 'hard';

interface VerbalMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CodingResult {
  score?: number;
  verdict?: string;
  feedback?: string;
  [key: string]: unknown;
}

interface SessionState {
  history: VerbalMessage[];
  phase: 'intro' | 'verbal' | 'coding';
  codingResult?: CodingResult;
  resumeContext?: string;
  verbalStartTime?: number;
  verbalDurationMs: number;
  difficulty_level: DifficultyLevel;
  cheatingFlags: string[];
  tabSwitchCount: number;
  faceAbsenceCount: number;
  userId?: string; // owner of this session
}

const VERBAL_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const activeSessions = new Map<string, SessionState>();
const sessionTimers = new Map<string, NodeJS.Timeout>();

export const initializeInterviewSocket = (io: Server) => {
  const interviewNamespace = io.of('/');

  interviewNamespace.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Track which session this socket is associated with
    let currentSessionId: string | null = null;
    // Extract userId from socket handshake auth (set by frontend)
    const socketUserId: string | undefined = (socket.handshake.auth as { userId?: string })?.userId || undefined;

    // -------------------------------------------------------
    // GUARD: validates that the event's sessionId matches
    // the session this socket joined — prevents one socket
    // from manipulating another user's session.
    // -------------------------------------------------------
    const isOwnSession = (sessionId: string): boolean => {
      if (!currentSessionId) return false;
      return currentSessionId === sessionId;
    };

    // -------------------------------------------------------
    // 1. START / JOIN SESSION
    // -------------------------------------------------------
    socket.on('start_voice_interview', async (data) => {
      const { sessionId, resumeContext } = data || {};
      if (!sessionId) return;

      socket.join(sessionId);
      currentSessionId = sessionId;

      if (!activeSessions.has(sessionId)) {
        console.log(`✨ New Session: ${sessionId}`);

        activeSessions.set(sessionId, {
          history: [],
          phase: 'intro',
          resumeContext: resumeContext || undefined,
          verbalStartTime: Date.now(),
          verbalDurationMs: VERBAL_DURATION_MS,
          difficulty_level: 'warmup',
          cheatingFlags: [],
          tabSwitchCount: 0,
          faceAbsenceCount: 0,
          userId: socketUserId,
        });

        // Start verbal countdown — auto-end at 10 min
        const timer = setTimeout(async () => {
          const state = activeSessions.get(sessionId);
          if (state && state.phase !== 'coding') {
            console.log(`⏰ Verbal time up for session ${sessionId}`);
            state.phase = 'coding';
            socket.emit('verbal_time_up', { message: 'Verbal round time is up.' });
            setTimeout(() => {
              io.to(sessionId).emit('start_coding_phase');
            }, 3000);
          }
          sessionTimers.delete(sessionId);
        }, VERBAL_DURATION_MS);

        sessionTimers.set(sessionId, timer);

        socket.emit('verbal_timer_start', { durationMs: VERBAL_DURATION_MS });

        try {
          const state = activeSessions.get(sessionId)!;
          const aiResponse = await aiService.generateVerbalResponse(
            [],
            'START_INTERVIEW',
            state.resumeContext,
            VERBAL_DURATION_MS / 1000,
            state.tabSwitchCount
          );
          state.history.push({ role: 'assistant', content: aiResponse.text });
          if (aiResponse.difficulty_level) {
            state.difficulty_level = aiResponse.difficulty_level as DifficultyLevel;
          }
          socket.emit('ai_speak', { text: aiResponse.text, difficulty_level: aiResponse.difficulty_level });
        } catch (e) {
          console.error('AI Init Error:', e);
          socket.emit('ai_speak', { text: 'Hello, I am Alex. Welcome to your technical interview. Let us begin with a quick introduction — tell me about yourself.' });
        }
      } else {
        console.log(`🔄 Resumed Session: ${sessionId}`);
        const state = activeSessions.get(sessionId)!;
        const elapsed = state.verbalStartTime ? Date.now() - state.verbalStartTime : 0;
        const remaining = Math.max(0, state.verbalDurationMs - elapsed);
        socket.emit('verbal_timer_start', { durationMs: state.verbalDurationMs, remainingMs: remaining });
      }
    });

    // -------------------------------------------------------
    // 2. VERBAL CONVERSATION
    // -------------------------------------------------------
    socket.on('user_speak', async (data) => {
      const { text, sessionId } = data;
      if (!sessionId || !text) return;
      if (!isOwnSession(sessionId)) {
        console.warn(`⚠️ Socket ${socket.id} tried to speak in session ${sessionId} it doesn't own`);
        return;
      }

      const state = activeSessions.get(sessionId);
      if (!state || state.phase === 'coding') return;

      state.history.push({ role: 'user', content: text });

      const elapsed = state.verbalStartTime ? Date.now() - state.verbalStartTime : 0;
      const remainingSeconds = Math.max(0, (state.verbalDurationMs - elapsed) / 1000);

      try {
        const aiResponse = await aiService.generateVerbalResponse(
          state.history,
          text,
          state.resumeContext,
          remainingSeconds,
          state.tabSwitchCount
        );

        // Re-read state after async call — phase may have changed (timer fired during AI call)
        const freshState = activeSessions.get(sessionId);
        if (!freshState || freshState.phase === 'coding') return;

        freshState.history.push({ role: 'assistant', content: aiResponse.text });
        if (aiResponse.difficulty_level) {
          freshState.difficulty_level = aiResponse.difficulty_level as DifficultyLevel;
        }

        socket.emit('ai_speak', {
          text: aiResponse.text,
          difficulty_level: aiResponse.difficulty_level,
          time_remaining_seconds: Math.round(remainingSeconds),
        });

        if (aiResponse.action === 'START_CODING') {
          freshState.phase = 'coding';
          setTimeout(() => {
            io.to(sessionId).emit('start_coding_phase');
          }, 4000);
        }

        if (aiResponse.action === 'TERMINATE') {
          socket.emit('interview_terminated', {
            reason: 'tab_switch_violation',
            message: aiResponse.text,
          });

          // Persist a terminated record so data isn't lost
          const resolvedUserId = socketUserId || freshState.userId || 'GUEST_USER';
          try {
            await connectToDatabase();
            await Interview.create({
              userId:       resolvedUserId,
              sessionId,
              score:        0,
              feedback:     'Interview terminated due to integrity violation.',
              verbatim:     freshState.history,
              improvements: [],
              verdict:      'Terminated',
              cheatingFlags: freshState.cheatingFlags,
              tabSwitches:  freshState.tabSwitchCount,
              date:         new Date(),
            });
          } catch (dbErr) {
            console.error('❌ DB Save Failed on TERMINATE:', dbErr);
          }
          activeSessions.delete(sessionId);
        }
      } catch (e) {
        console.error('AI Response Error:', e);
      }
    });

    // -------------------------------------------------------
    // 3. ANTI-CHEAT EVENTS
    // -------------------------------------------------------
    socket.on('cheat_event', ({ sessionId, type, detail }) => {
      if (!sessionId || !isOwnSession(sessionId)) return;

      const state = activeSessions.get(sessionId);
      if (!state) return;

      const flag = `[${new Date().toISOString()}] ${type}: ${detail || ''}`;
      state.cheatingFlags.push(flag);

      if (type === 'tab_switch') {
        state.tabSwitchCount++;
        console.log(`🚨 Tab switch #${state.tabSwitchCount} in session ${sessionId}`);
      }
      if (type === 'face_absent') {
        state.faceAbsenceCount++;
      }

      if (state.tabSwitchCount === 2) {
        socket.emit('ai_speak', {
          text: 'I noticed you switched tabs. Please keep the interview window focused.',
          difficulty_level: state.difficulty_level,
        });
      }
      if (state.faceAbsenceCount >= 5) {
        socket.emit('ai_speak', {
          text: 'Please make sure your camera is visible and your face is in frame.',
          difficulty_level: state.difficulty_level,
        });
        state.faceAbsenceCount = 0;
      }
    });

    // -------------------------------------------------------
    // 4. SAVE CODING RESULT
    // -------------------------------------------------------
    socket.on('submit_code_result', ({ sessionId, result }) => {
      if (!sessionId || !isOwnSession(sessionId)) return;
      const state = activeSessions.get(sessionId);
      if (state) state.codingResult = result as CodingResult;
    });

    // -------------------------------------------------------
    // 5. END INTERVIEW & GENERATE REPORT
    // -------------------------------------------------------
    socket.on('end_interview', async ({ sessionId, userId }) => {
      if (!sessionId || !isOwnSession(sessionId)) {
        socket.emit('error', { message: 'Unauthorized.' });
        return;
      }
      console.log(`🏁 Ending Interview for: ${sessionId}`);

      const state = activeSessions.get(sessionId);
      if (!state) {
        socket.emit('error', { message: 'Session data not found.' });
        return;
      }

      // Validate session ownership when userId is known
      if (state.userId && userId && state.userId !== userId) {
        console.warn(`⚠️ userId mismatch on end_interview: expected ${state.userId}, got ${userId}`);
        socket.emit('error', { message: 'Unauthorized.' });
        return;
      }

      // Clear the verbal timer if still running
      const timer = sessionTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        sessionTimers.delete(sessionId);
      }

      try {
        socket.emit('feedback_processing', { message: 'Analyzing performance...' });

        const reportTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Report generation timed out after 30s')), 30_000)
        );
        const report = await Promise.race([
          aiService.generateFinalFeedback(state.history, state.codingResult),
          reportTimeout,
        ]);
        console.log(`📊 Report Generated. Score: ${report.score}/100`);

        // Emit results to client immediately — don't block on DB save
        socket.emit('interview_results', {
          success: true,
          sessionId,
          ...report,
          cheatingFlags: state.cheatingFlags.length,
        });

        activeSessions.delete(sessionId);

        // Persist to DB asynchronously — failure is logged but doesn't affect user
        const resolvedUserId = userId || state.userId || 'GUEST_USER';
        try {
          await connectToDatabase();
          const newInterview = await Interview.create({
            userId:       resolvedUserId,
            sessionId:    sessionId,
            score:        report.score,
            feedback:     report.feedback_summary,
            verbatim:     state.history,
            improvements: report.areas_for_improvement || [],
            verdict:      report.score >= 70 ? 'Passed' : 'Needs Improvement',
            cheatingFlags: state.cheatingFlags,
            tabSwitches:  state.tabSwitchCount,
            date:         new Date(),
          });
          console.log(`✅ Saved to DB: ${newInterview._id}`);
        } catch (dbError) {
          console.error('❌ DB Save Failed (results already sent to client):', dbError);
        }
      } catch (error) {
        console.error('Report Generation Error:', error);
        socket.emit('error', { message: 'Failed to generate report.' });
      }
    });

    // -------------------------------------------------------
    // 6. DISCONNECT — cleanup timers & stale sessions
    // -------------------------------------------------------
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      if (currentSessionId) {
        const room = io.of('/').adapter.rooms.get(currentSessionId);
        if (!room || room.size === 0) {
          const timer = sessionTimers.get(currentSessionId);
          if (timer) {
            clearTimeout(timer);
            sessionTimers.delete(currentSessionId);
            console.log(`🧹 Cleared timer for abandoned session: ${currentSessionId}`);
          }
          const cleanupSessionId = currentSessionId;
          setTimeout(() => {
            const room = io.of('/').adapter.rooms.get(cleanupSessionId);
            if (!room || room.size === 0) {
              activeSessions.delete(cleanupSessionId);
              console.log(`🧹 Cleaned up abandoned session: ${cleanupSessionId}`);
            }
          }, 30 * 60 * 1000);
        }
      }
    });
  });
};
