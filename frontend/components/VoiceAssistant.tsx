import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// --- TYPE DEFINITIONS ---
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface VoiceAssistantProps {
  sessionId: string;
  onCodingStart: () => void;
}

type AIState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export default function VoiceAssistant({ sessionId, onCodingStart }: VoiceAssistantProps) {
  // --- STATE ---
  const [hasStarted, setHasStarted] = useState(false);
  const [aiState, setAiState] = useState<AIState>('IDLE');
  const [transcript, setTranscript] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // --- REFS ---
  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // FIX: Use Ref for callback to prevent useEffect re-triggering on parent re-renders
  const onCodingStartRef = useRef(onCodingStart);
  useEffect(() => { onCodingStartRef.current = onCodingStart; }, [onCodingStart]);

  // --- 1. ROBUST SOCKET CONNECTION ---
  useEffect(() => {
    if (!sessionId) return;
    if (socketRef.current) return; // Prevent duplicate connections

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    
    // FIX: Transports set to ['polling', 'websocket'] to match backend
    socketRef.current = io(apiUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'], 
      reconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log("✅ AI Assistant Connected");
      setConnectionStatus('connected');
    });

    socket.on('connect_error', (err) => {
      console.error("❌ Socket Error:", err.message);
      setConnectionStatus('error');
    });

    socket.on('ai_speak', (data: { text: string }) => {
      speakText(data.text);
    });

    socket.on('start_coding_phase', () => {
      speakText("Excellent. Let's move to the coding environment now.");
      setTimeout(() => {
        // Call the ref function safely
        if (onCodingStartRef.current) onCodingStartRef.current();
      }, 3000); 
    });

    return () => {
      socket.disconnect();
      socketRef.current = null; // Clear ref on unmount
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [sessionId]); // Removed onCodingStart from dependencies

  // --- 2. HUMAN-LIKE SPEECH SYNTHESIS ---
  const speakText = (text: string) => {
    if (typeof window === 'undefined') return;

    // Clean text (Remove Markdown/Code blocks)
    const cleanText = text.replace(/[*#`_]/g, '').replace(/```[\s\S]*?```/g, 'code block');

    stopListening();
    setAiState('SPEAKING');
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Select "Google" or "Natural" Voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google US English') || 
      v.name.includes('Microsoft Zira') || 
      v.name.includes('Samantha')
    );
    
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.05; 
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setAiState('IDLE');
      setTimeout(() => startListening(), 500); 
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- 3. SPEECH RECOGNITION ---
  const startListening = useCallback(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechAPI = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechAPI) return; 

    if (!recognitionRef.current) {
      const recognition = new SpeechAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setAiState('LISTENING');
      
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text.trim()) {
          setTranscript(text);
          setAiState('THINKING');
          socketRef.current?.emit('user_speak', { text });
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Mic Error:", event.error);
        }
        setAiState('IDLE');
      };

      recognition.onend = () => {
        if (aiState === 'LISTENING') setAiState('IDLE');
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      // Ignore
    }
  }, [aiState]);

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // --- 4. START INTERACTION ---
  const handleStartInteraction = () => {
    setHasStarted(true);
    
    const warmUp = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(warmUp);

    socketRef.current?.emit('start_voice_interview', { sessionId });
  };

  return (
    <>
      {/* START OVERLAY */}
      {!hasStarted && (
        <div className="overlay">
          <div className="glass-card">
            <h2>AI Interviewer Ready</h2>
            <p>Click below to activate the microphone and start.</p>
            
            {/* Connection Status */}
            <div className="connection-status">
              {connectionStatus === 'connecting' && <div className="status connecting">Connecting...</div>}
              {connectionStatus === 'connected' && <div className="status connected">● Online</div>}
              {connectionStatus === 'error' && <div className="status error">● Connection Error</div>}
            </div>

            <button 
              onClick={handleStartInteraction} 
              className="start-btn"
              disabled={connectionStatus !== 'connected'}
            >
              {connectionStatus === 'connected' ? "Begin Interview" : "Waiting for Server..."}
            </button>
          </div>
        </div>
      )}

      {/* HUD INTERFACE */}
      <div className="hud-container">
        <div className="status-label">
          {aiState === 'SPEAKING' && <span className="ai-text">AI Speaking...</span>}
          {aiState === 'LISTENING' && <span className="user-text">Listening...</span>}
          {aiState === 'THINKING' && <span className="sys-text">Thinking...</span>}
          {aiState === 'IDLE' && <span className="sys-text">Ready</span>}
        </div>

        {/* ORB VISUALIZER */}
        <div className={`orb ${aiState}`}>
          <div className="orb-core"></div>
          <div className="orb-glow"></div>
        </div>

        {/* TRANSCRIPT */}
        {transcript && <div className="captions-box">&quot;{transcript}&quot;</div>}
      </div>

      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
        .glass-card { background: rgba(30, 30, 30, 0.9); padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); text-align: center; color: white; box-shadow: 0 8px 32px rgba(0,0,0,0.5); width: 350px; }
        .start-btn { margin-top: 20px; padding: 12px 30px; font-size: 1rem; font-weight: bold; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 50px; cursor: pointer; }
        .start-btn:disabled { background: #555; cursor: not-allowed; }
        .connection-status { margin: 15px 0; font-size: 0.9rem; }
        .status.connected { color: #4ade80; }
        .status.connecting { color: #facc15; }
        .status.error { color: #ef4444; }
        
        .hud-container { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 15px; z-index: 1000; pointer-events: none; }
        .status-label { font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .ai-text { color: #60a5fa; } .user-text { color: #4ade80; } .sys-text { color: #94a3b8; }
        .captions-box { background: rgba(0,0,0,0.6); color: rgba(255,255,255,0.9); padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; max-width: 300px; text-align: center; font-style: italic; }
        
        /* ORB STYLES */
        .orb { width: 80px; height: 80px; position: relative; display: flex; justify-content: center; align-items: center; }
        .orb-core { width: 50px; height: 50px; background: #fff; border-radius: 50%; z-index: 2; box-shadow: inset 0 -5px 10px rgba(0,0,0,0.2); }
        .orb-glow { position: absolute; width: 100%; height: 100%; border-radius: 50%; z-index: 1; filter: blur(15px); opacity: 0.6; transition: all 0.3s ease; }
        .orb.IDLE .orb-core { background: #475569; } .orb.IDLE .orb-glow { background: #475569; transform: scale(0.8); }
        .orb.SPEAKING .orb-core { background: #3b82f6; animation: pulse 1s infinite; } .orb.SPEAKING .orb-glow { background: #2563eb; transform: scale(1.2); }
        .orb.LISTENING .orb-core { background: #4ade80; } .orb.LISTENING .orb-glow { background: #22c55e; transform: scale(1.1); }
        .orb.THINKING .orb-core { background: #f59e0b; animation: spin 1s linear infinite; } .orb.THINKING .orb-glow { background: #d97706; }
        
        @keyframes pulse { 0% { transform: scale(0.95); } 50% { transform: scale(1.05); } 100% { transform: scale(0.95); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}