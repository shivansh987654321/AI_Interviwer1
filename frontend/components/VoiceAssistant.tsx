import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// --- TYPE DEFINITIONS ---
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  voiceAssistantGlobalUtterance?: SpeechSynthesisUtterance; 
}

interface VoiceAssistantProps {
  sessionId: string;
  onCodingStart: () => void;
  apiEndpoint?: string; 
}

type AIState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function VoiceAssistant({ 
  sessionId, 
  onCodingStart,
  apiEndpoint = 'http://localhost:5001'
}: VoiceAssistantProps) {
  
  // --- STATE ---
  const [hasStarted, setHasStarted] = useState(false);
  const [aiState, setAiState] = useState<AIState>('IDLE');
  const [transcript, setTranscript] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [debugMsg, setDebugMsg] = useState("Initializing...");
  const [voicesLoaded, setVoicesLoaded] = useState(false); 
  
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  
  // --- REFS ---
  const aiStateRef = useRef<AIState>('IDLE'); 
  const isSpeakingRef = useRef(false); 
  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<any>(null);
  const isMounted = useRef(true); 
  
  // Ref for the callback to prevent dependency loops
  const onCodingStartRef = useRef(onCodingStart);
  
  const queueLengthRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef(""); 

  // Sync Refs
  useEffect(() => { aiStateRef.current = aiState; }, [aiState]);
  useEffect(() => { queueLengthRef.current = speechQueue.length; }, [speechQueue]);
  useEffect(() => { onCodingStartRef.current = onCodingStart; }, [onCodingStart]);

  // --- 0. VOICE LOADER ---
  useEffect(() => {
    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        setDebugMsg("Voices Ready.");
      }
    };
    checkVoices();
    window.speechSynthesis.onvoiceschanged = checkVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // --- 1. SOCKET CONNECTION (STABILIZED) ---
  useEffect(() => {
    if (!sessionId) return;
    
    // 🛑 CRITICAL FIX: If socket is already alive, DO NOT RECONNECT.
    // This stops the "Hello, I am Rohan" loop.
    if (socketRef.current && socketRef.current.connected) {
        console.log("⚡ Socket already active, skipping reconnect.");
        return; 
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || apiEndpoint;
    console.log("🔌 Connecting Socket:", apiUrl);
    setConnectionStatus('connecting');

    // Only disconnect if we have a BROKEN socket
    if (socketRef.current) {
        socketRef.current.disconnect();
    }

    const newSocket = io(apiUrl, { 
        withCredentials: true, 
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        autoConnect: true
    });
    
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
        console.log("✅ Socket Connected");
        setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
        console.log("❌ Socket Disconnected");
        setConnectionStatus('disconnected');
    });

    newSocket.on('ai_speak', (data: { text: string }) => {
        console.log("📩 Received AI Text:", data.text);
        setTranscript(""); 
        setSpeechQueue(prev => {
            const newQ = [...prev, data.text];
            queueLengthRef.current = newQ.length;
            return newQ;
        });
    });

    newSocket.on('start_coding_phase', () => {
        setSpeechQueue(prev => [...prev, "Let's move to the coding challenge."]);
        setTimeout(() => { 
            if (onCodingStartRef.current) onCodingStartRef.current(); 
        }, 4000);
    });

    // 🛑 STOP THE BLINKING: We commented out the disconnect here.
    // This prevents React "Strict Mode" from killing the connection every time you save.
    return () => {
        // console.log("🧹 Keeping socket alive during re-renders");
        // if (newSocket) newSocket.disconnect(); // <--- DISABLED FOR STABILITY
    };
  }, [sessionId, apiEndpoint]); 

  // --- 2. SPEECH RECOGNITION ---
  const startListening = useCallback(() => {
    if (isSpeakingRef.current || aiStateRef.current === 'THINKING' || queueLengthRef.current > 0) return;

    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechAPI = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechAPI) return;

    // Don't kill existing recognition if it's running
    if (recognitionRef.current && aiStateRef.current === 'LISTENING') return;

    if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
    }

    const recognition = new SpeechAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        setAiState('LISTENING');
        setDebugMsg("Mic Listening...");
    };
    
    recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
        fullTranscriptRef.current = currentText;

        // Smart Silence Timer (2 seconds)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            handleUserFinishedSpeaking();
        }, 5000); 
    };

    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
             setAiState('ERROR');
             setDebugMsg("Microphone Blocked");
        }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { }
  }, []); 

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const handleUserFinishedSpeaking = () => {
      stopListening();
      const text = fullTranscriptRef.current.trim();
      if (!text) {
          startListening(); 
          return;
      }
      console.log("🚀 Sending User Audio:", text);
      setAiState('THINKING');
      if (socketRef.current?.connected) {
        socketRef.current.emit('user_speak', { text, sessionId });
      }
      fullTranscriptRef.current = "";
  };

  // --- 3. SPEECH SYNTHESIS ---
  const speakText = useCallback((text: string) => {
    if (!text) {
        setSpeechQueue(prev => {
            const next = prev.slice(1);
            if (next.length === 0) setTimeout(() => startListening(), 300);
            return next;
        });
        return;
    }

    isSpeakingRef.current = true;
    stopListening(); 

    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    
    const utterance = new SpeechSynthesisUtterance(text);
    (window as unknown as IWindow).voiceAssistantGlobalUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    // Try to find a good voice
    let preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setAiState('SPEAKING');
    
    const handleEnd = () => {
        isSpeakingRef.current = false;
        delete (window as unknown as IWindow).voiceAssistantGlobalUtterance;
        
        setSpeechQueue(prev => {
            const nextQueue = prev.slice(1);
            queueLengthRef.current = nextQueue.length;
            
            // IF QUEUE IS EMPTY -> START MIC
            if (nextQueue.length === 0) {
                 setAiState('IDLE');
                 setTranscript(""); 
                 setTimeout(() => { startListening(); }, 300);
            }
            return nextQueue;
        });
    };

    utterance.onend = handleEnd;
    utterance.onerror = (e) => handleEnd();

    window.speechSynthesis.speak(utterance);
  }, [startListening, stopListening]);

  // Queue Watcher
  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeakingRef.current) {
        speakText(speechQueue[0]);
    }
  }, [speechQueue, speakText]);

  // --- 4. START BUTTON ---
  const handleStartInteraction = () => {
    const u = new SpeechSynthesisUtterance("Okay.");
    u.volume = 0.1;
    window.speechSynthesis.speak(u);
    
    setHasStarted(true);
    setAiState('IDLE');
    
    if (socketRef.current?.connected) {
        socketRef.current.emit('start_voice_interview', { sessionId });
    }
  };

  const handleManualReset = () => {
      window.speechSynthesis.cancel();
      stopListening();
      isSpeakingRef.current = false;
      setSpeechQueue([]);
      setAiState('IDLE');
      setTimeout(() => startListening(), 500);
  };

  const getStatusColor = () => {
      switch (aiState) {
          case 'SPEAKING': return '#3b82f6';
          case 'LISTENING': return '#4ade80';
          case 'THINKING': return '#f59e0b';
          default: return '#94a3b8';
      }
  };

  return (
    <>
      {!hasStarted && (
        <div className="voice-overlay">
          <div className="glass-card">
            <h2>AI Interviewer Ready</h2>
            <button 
              onClick={handleStartInteraction} 
              className="start-btn"
              disabled={connectionStatus !== 'connected' || !voicesLoaded}
            >
              {connectionStatus !== 'connected' ? "Connecting..." : "Begin Interview"}
            </button>
            <div className="debug-info" style={{marginTop:'10px'}}>Status: {connectionStatus}</div>
          </div>
        </div>
      )}

      <div className="hud-container">
        <div className="status-label" style={{ color: getStatusColor() }}>{aiState}</div>
        <div className={`orb ${aiState}`}>
          <div className="orb-core"></div>
          <div className="orb-glow"></div>
        </div>
        {transcript && <div className="captions-box">You: &quot;{transcript}&quot;</div>}
        <div className="controls">
            <button onClick={handleManualReset} className="reset-btn">↻ Reset</button>
        </div>
      </div>
      <style jsx>{`
        .voice-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
        .glass-card { background: rgba(30, 30, 30, 0.95); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 90%; max-width: 400px; }
        .hud-container { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 1000; pointer-events: none; }
        .hud-container button { pointer-events: auto; }
        .status-label { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 12px; color: white; }
        .captions-box { background: rgba(0, 0, 0, 0.7); color: rgba(255, 255, 255, 0.95); padding: 10px 20px; border-radius: 12px; font-size: 0.95rem; max-width: 80vw; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
        .start-btn { width: 100%; padding: 14px; font-size: 1rem; font-weight: 600; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; cursor: pointer; margin-top: 15px; }
        .start-btn:disabled { background: #475569; cursor: not-allowed; }
        .reset-btn { padding: 6px 12px; font-size: 0.75rem; border-radius: 6px; border: none; cursor: pointer; background: #ef4444; color: white; opacity: 0.8; }
        .orb { width: 80px; height: 80px; position: relative; display: flex; justify-content: center; align-items: center; }
        .orb-core { width: 40px; height: 40px; background: #fff; border-radius: 50%; z-index: 10; transition: background 0.3s; }
        .orb-glow { position: absolute; width: 100%; height: 100%; border-radius: 50%; z-index: 1; filter: blur(20px); opacity: 0.5; transition: all 0.3s; }
        .orb.IDLE .orb-core { background: #94a3b8; }
        .orb.LISTENING .orb-core { background: #4ade80; }
        .orb.LISTENING .orb-glow { background: #22c55e; transform: scale(1.2); }
        .orb.THINKING .orb-core { background: #f59e0b; }
        .orb.SPEAKING .orb-core { background: #3b82f6; }
      `}</style>
    </>
  );
}