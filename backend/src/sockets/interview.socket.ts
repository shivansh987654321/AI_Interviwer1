import { Server, Socket } from 'socket.io';
import geminiService from '../services/gemini.service';

// --- SESSION MEMORY ---
interface SessionState {
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  phase: 'intro' | 'verbal' | 'coding';
}

// Global memory to store chat history
const activeSessions = new Map<string, SessionState>();

export const initializeInterviewSocket = (io: Server) => {
  const interviewNamespace = io.of('/'); 

  interviewNamespace.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- 1. START/JOIN SESSION ---
    socket.on('start_voice_interview', async ({ sessionId }) => {
      if (!sessionId) return;
      
      socket.join(sessionId);

      // Check if session exists in memory
      let state = activeSessions.get(sessionId);

      if (!state) {
        // ✨ NEW SESSION
        console.log(`✨ Creating NEW Session: ${sessionId}`);
        state = { history: [], phase: 'intro' };
        activeSessions.set(sessionId, state);

        try {
          // Generate the First Greeting
          const aiResponse = await geminiService.generateVerbalResponse([], "START_INTERVIEW");
          
          state.history.push({ role: 'assistant', content: aiResponse.text });
          socket.emit('ai_speak', { text: aiResponse.text });
        } catch (error) {
          socket.emit('ai_speak', { text: "Hello! I am Alex. Could you tell me about your background?" });
        }
      } else {
        // 🔄 RESUMING SESSION
        console.log(`🔄 Resumed Session: ${sessionId} (History Length: ${state.history.length})`);
        // We do NOT emit 'ai_speak' here, so the AI stays silent and waits for the user
      }
    });

    // --- 2. HANDLE USER SPEECH ---
    socket.on('user_speak', async (data: { text: string, sessionId: string }) => {
      const { text, sessionId } = data;
      
      if (!sessionId || !activeSessions.has(sessionId)) {
        // If server restarted, we might lose the session. 
        // silently re-create it to prevent crash, but don't reset intro.
        if (sessionId && !activeSessions.has(sessionId)) {
             activeSessions.set(sessionId, { history: [], phase: 'intro' });
        }
      }

      const state = activeSessions.get(sessionId)!;
      console.log(`🗣️ User (${sessionId}): ${text}`);

      // Add User input to history
      state.history.push({ role: 'user', content: text });

      try {
        // Generate AI Reply
        const aiResponse = await geminiService.generateVerbalResponse(
          state.history, 
          text
        );

        // Add AI response to history
        state.history.push({ role: 'assistant', content: aiResponse.text });

        // Emit Audio
        socket.emit('ai_speak', { text: aiResponse.text });

        // Phase Switch Check
        if (aiResponse.action === 'START_CODING') {
          console.log(`🚀 Switching to CODING PHASE for ${sessionId}`);
          state.phase = 'coding';
          setTimeout(() => {
            io.to(sessionId).emit('start_coding_phase');
          }, 4000);
        }

      } catch (error) {
        console.error("❌ AI Gen Error:", error);
        socket.emit('ai_speak', { text: "Could you repeat that?" });
      }
    });

    socket.on('disconnect', () => {
      // Keep session in memory for a while
    });
  });
};