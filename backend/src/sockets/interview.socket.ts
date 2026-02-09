import { Server, Socket } from 'socket.io';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// --- SESSION MEMORY (Prevents "Hello" loop on reconnect) ---
interface SessionState {
  phase: 'intro' | 'hr' | 'technical' | 'coding' | 'closure';
  transcript: string[];
  turnCount: number;
}
const activeSessions = new Map<string, SessionState>();

export const initializeInterviewSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- 1. JOIN SESSION ---
    socket.on('start_voice_interview', async ({ sessionId }) => {
      socket.join(sessionId); 

      // Check if we already know this user
      let state = activeSessions.get(sessionId);

      if (!state) {
        // NEW USER: Initialize state
        state = { phase: 'intro', transcript: [], turnCount: 0 };
        activeSessions.set(sessionId, state);
        
        // Generate Dynamic Opening
        const greeting = await generateAIResponse(
          "Start the interview. Greet the candidate professionally and ask for a brief introduction.", 
          'intro', 
          []
        );
        speakAndLog(io, sessionId, greeting, state);
      } else {
        console.log(`🔄 Resuming session ${sessionId} at phase ${state.phase}`);
        // Optionally welcome them back if needed, but usually better to stay silent
      }
    });

    // --- 2. HANDLE USER SPEECH ---
    socket.on('user_speak', async (data: { text: string }) => {
      // Find the user's session from the socket rooms
      const sessionId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (!sessionId) return;

      const state = activeSessions.get(sessionId);
      if (!state) return;

      console.log(`🗣️ User (${state.phase}): ${data.text}`);
      state.transcript.push(`User: ${data.text}`);
      state.turnCount++;

      // --- PHASE TRANSITION LOGIC ---
      
      // Phase 1: Intro -> HR (After 2 turns)
      if (state.phase === 'intro' && state.turnCount >= 2) {
        state.phase = 'hr';
        state.turnCount = 0;
        const msg = "Thank you. Let's move to behavioral questions. Why do you want to join our company?";
        await speakAndLog(io, sessionId, msg, state);
        return;
      }

      // Phase 2: HR -> Technical (After 3 turns)
      if (state.phase === 'hr' && state.turnCount >= 3) {
        state.phase = 'technical';
        state.turnCount = 0;
        const msg = "Understood. Let's switch to technical topics. Can you explain the difference between a Process and a Thread?";
        await speakAndLog(io, sessionId, msg, state);
        return;
      }

      // Phase 3: Technical -> Coding (After 3 turns)
      if (state.phase === 'technical' && state.turnCount >= 3) {
        state.phase = 'coding';
        state.turnCount = 0;
        const msg = "Excellent. Let's test your problem-solving skills. I am opening the coding environment now.";
        
        // TRIGGER FRONTEND TO SWITCH MODES
        io.to(sessionId).emit('start_coding_phase');
        await speakAndLog(io, sessionId, msg, state);
        return;
      }

      // --- GENERATE INTELLIGENT RESPONSE (If no phase change) ---
      const reply = await generateAIResponse(data.text, state.phase, state.transcript);
      await speakAndLog(io, sessionId, reply, state);
    });

    socket.on('disconnect', () => {
      // We do NOT delete the session here to allow reconnection
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};

// Helper to send audio and save text
async function speakAndLog(io: Server, sessionId: string, text: string, state: SessionState) {
  state.transcript.push(`AI: ${text}`);
  io.to(sessionId).emit('ai_speak', { text });
}

// AI Brain
async function generateAIResponse(userText: string, phase: string, history: string[]): Promise<string> {
  const systemPrompt = `
    You are Alex, an expert technical interviewer.
    Current Phase: ${phase.toUpperCase()}.
    
    RULES:
    1. Ask ONE clear question at a time.
    2. Keep responses short (max 2 sentences).
    3. NO CODE BLOCKS. NO MARKDOWN. Speak in plain English only.
    4. If the user is unclear, ask them to clarify.
    5. Be professional but encouraging.
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({ 
            role: h.startsWith('AI:') ? 'assistant' : 'user', 
            content: h.replace(/^(AI:|User:)\s*/, '') 
        })) as any,
        { role: 'user', content: userText }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 100
    });
    return completion.choices[0]?.message?.content || "Could you repeat that?";
  } catch (e) {
    return "I see. Let's move to the next topic.";
  }
}