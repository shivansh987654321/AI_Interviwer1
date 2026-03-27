import { Server, Socket } from 'socket.io';
import aiService from '../services/ai.service';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';

// --- DEFINITIONS ---
interface SessionState {
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  phase: 'intro' | 'verbal' | 'coding';
  codingResult?: any;
}

// Store active sessions in memory
const activeSessions = new Map<string, SessionState>();

export const initializeInterviewSocket = (io: Server) => {
  // Use the default namespace or create a specific one if needed
  const interviewNamespace = io.of('/'); 

  interviewNamespace.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- 1. START/JOIN SESSION ---
    socket.on('start_voice_interview', async (data) => {
      const sessionId = data?.sessionId;
      if (!sessionId) return;
      
      socket.join(sessionId);
      
      if (!activeSessions.has(sessionId)) {
        console.log(`✨ New Session Initialized: ${sessionId}`);
        // Initialize state
        activeSessions.set(sessionId, { 
          history: [], 
          phase: 'intro' 
        });
        
        // Generate greeting
        try {
            // Passing empty history to get the first greeting
            const aiResponse = await aiService.generateVerbalResponse([], "START_INTERVIEW");
            
            const state = activeSessions.get(sessionId)!;
            state.history.push({ role: 'assistant', content: aiResponse.text });
            
            // Send audio/text to client
            socket.emit('ai_speak', { text: aiResponse.text });
        } catch (e) { 
            console.error("AI Init Error:", e);
            socket.emit('ai_speak', { text: "Hello. I am ready to begin your interview." }); 
        }
      } else {
        console.log(`🔄 Resumed Session: ${sessionId}`);
      }
    });

    // --- 2. VERBAL CONVERSATION ---
    socket.on('user_speak', async (data) => {
      const { text, sessionId } = data;
      if (!sessionId || !text) return;

      const state = activeSessions.get(sessionId);
      if (!state) return;

      // 1. Add User input to history
      state.history.push({ role: 'user', content: text });

      try {
        // 2. Get AI Response
        const aiResponse = await aiService.generateVerbalResponse(state.history, text);
        
        // 3. Add AI response to history
        state.history.push({ role: 'assistant', content: aiResponse.text });
        
        // 4. Send back to client
        socket.emit('ai_speak', { text: aiResponse.text });

        // 5. Check if AI wants to switch to coding
        if (aiResponse.action === 'START_CODING') {
          state.phase = 'coding';
          // Give the user a moment to hear the instructions before switching UI
          setTimeout(() => {
            io.to(sessionId).emit('start_coding_phase');
          }, 4000);
        }
      } catch (e) { 
        console.error("AI Response Error:", e);
      }
    });

    // --- 3. SAVE CODING RESULT ---
    socket.on('submit_code_result', ({ sessionId, result }) => {
        if (!sessionId) return;
        console.log(`💾 Coding Result Received for ${sessionId}`);
        
        const state = activeSessions.get(sessionId);
        if (state) {
            state.codingResult = result; 
        }
    });

    // --- 4. END INTERVIEW & GENERATE REPORT ---
    socket.on('end_interview', async ({ sessionId, userId }) => {
      console.log(`🏁 Ending Interview for Session: ${sessionId}, User: ${userId}`);
      
      const state = activeSessions.get(sessionId);
      if (!state) {
        socket.emit('error', { message: "Session data not found." });
        return;
      }

      try {
        // Notify client that we are working
        socket.emit('feedback_processing', { message: "Analyzing performance..." });

        // A. Generate Report using Gemini
        // We pass the verbal history AND the coding result
        const report = await aiService.generateFinalFeedback(
            state.history, 
            state.codingResult
        );
        
        console.log(`📊 Report Generated. Score: ${report.score}/100`);

        // B. SAVE TO DATABASE (MongoDB)
        try {
            await connectToDatabase();
            
            const newInterview = await Interview.create({
                userId: userId || "GUEST_USER", // Uses the real User ID from Clerk now!
                sessionId: sessionId,           // ✅ Vital for the Report Page to find this
                score: report.score,
                feedback: report.feedback_summary,
                verbatim: state.history,
                improvements: report.areas_for_improvement || [],
                verdict: report.score >= 70 ? "Passed" : "Needs Improvement",
                date: new Date()
            });
            
            console.log(`✅ Saved to DB with ID: ${newInterview._id}`);
            
            // C. Send Success to Client (✅ FIX APPLIED HERE)
            // We spread "...report" so "score" and "breakdown" are at the top level
            socket.emit('interview_results', {
                success: true,
                sessionId: sessionId,
                ...report 
            });

            // Cleanup memory
            activeSessions.delete(sessionId);

        } catch (dbError) {
            console.error("❌ Database Save Failed:", dbError);
            socket.emit('error', { message: "Failed to save results to database." });
        }

      } catch (error) {
        console.error("Report Generation Error:", error);
        socket.emit('error', { message: "Failed to generate report." });
      }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};