import { Server, Socket } from 'socket.io';
import geminiService from '../services/gemini.service';

// --- SESSION MEMORY ---
interface SessionState {
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  phase: 'intro' | 'verbal' | 'coding';
  codingResult?: any; // 🆕 Added to store coding score
}

const activeSessions = new Map<string, SessionState>();

export const initializeInterviewSocket = (io: Server) => {
  const interviewNamespace = io.of('/'); 

  interviewNamespace.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- 1. START/JOIN ---
    socket.on('start_voice_interview', async ({ sessionId }) => {
      if (!sessionId) return;
      socket.join(sessionId);
      
      if (!activeSessions.has(sessionId)) {
        console.log(`✨ New Session: ${sessionId}`);
        activeSessions.set(sessionId, { history: [], phase: 'intro' });
        
        try {
            const aiResponse = await geminiService.generateVerbalResponse([], "START_INTERVIEW");
            const state = activeSessions.get(sessionId)!;
            state.history.push({ role: 'assistant', content: aiResponse.text });
            socket.emit('ai_speak', { text: aiResponse.text });
        } catch (e) { 
            socket.emit('ai_speak', { text: "Hello. Let's begin." }); 
        }
      } else {
        console.log(`🔄 Resumed: ${sessionId}`);
      }
    });

    // --- 2. VERBAL CONVERSATION ---
    socket.on('user_speak', async (data) => {
      const { text, sessionId } = data;
      const state = activeSessions.get(sessionId);
      if (!state) return;

      state.history.push({ role: 'user', content: text });

      try {
        const aiResponse = await geminiService.generateVerbalResponse(state.history, text);
        state.history.push({ role: 'assistant', content: aiResponse.text });
        socket.emit('ai_speak', { text: aiResponse.text });

        if (aiResponse.action === 'START_CODING') {
          state.phase = 'coding';
          setTimeout(() => io.to(sessionId).emit('start_coding_phase'), 4000);
        }
      } catch (e) { console.error(e); }
    });

    // --- 3. SAVE CODING RESULT (🆕 Call this from your Coding Page) ---
    socket.on('submit_code_result', ({ sessionId, result }) => {
        console.log(`💾 Coding Result Saved for ${sessionId}:`, result);
        const state = activeSessions.get(sessionId);
        if (state) {
            state.codingResult = result; // Save the marks!
        }
    });

    // --- 4. GENERATE FINAL REPORT CARD ---
    socket.on('end_interview', async ({ sessionId }) => {
      console.log(`🏁 Generating Final Report for: ${sessionId}`);
      const state = activeSessions.get(sessionId);
      
      if (!state) {
        socket.emit('error', { message: "Session missing." });
        return;
      }

      socket.emit('feedback_processing', { message: "Analyzing Verbal & Coding performance..." });

      // Pass BOTH history AND codingResult to the grader
      const report = await geminiService.generateFinalFeedback(
          state.history, 
          state.codingResult
      );
      
      console.log(`📊 Final Score: ${report.score}/100`);
      socket.emit('interview_results', report);
    });

    socket.on('disconnect', () => {});
  });
};