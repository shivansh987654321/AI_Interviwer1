import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// --- TYPES ---
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

// Type for the Report Card Data
interface ReportCard {
  score: number;
  breakdown: {
    communication: number;
    technical: number;
    problem_solving: number;
  };
  feedback_summary: string;
  key_strengths: string[];
  areas_for_improvement: string[];
}

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

  // REPORT CARD STATE
  const [isEnding, setIsEnding] = useState(false);
  const [reportData, setReportData] = useState<ReportCard | null>(null);
  
  // --- REFS ---
  const aiStateRef = useRef<AIState>('IDLE'); 
  const isSpeakingRef = useRef(false); 
  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<any>(null);
  
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

  // --- 1. SOCKET CONNECTION ---
  useEffect(() => {
    if (!sessionId) return;
    
    if (socketRef.current && socketRef.current.connected) {
        console.log("⚡ Socket already active, skipping reconnect.");
        return; 
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || apiEndpoint;
    console.log("🔌 Connecting Socket:", apiUrl);
    setConnectionStatus('connecting');

    if (socketRef.current) socketRef.current.disconnect();

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

    // 🆕 LISTEN FOR REPORT CARD
    newSocket.on('feedback_processing', (data: { message: string }) => {
        setDebugMsg(data.message);
        setIsEnding(true); // Show loading spinner
    });

    newSocket.on('interview_results', (data: ReportCard) => {
        console.log("📊 Report Received:", data);
        setIsEnding(false);
        setReportData(data); // Show the Modal
        // Stop audio
        window.speechSynthesis.cancel();
    });

    return () => {
        if (newSocket) {
            newSocket.removeAllListeners();
            newSocket.disconnect();
        }
    };
  }, [sessionId, apiEndpoint]); 

  // --- 2. SPEECH RECOGNITION ---
  const startListening = useCallback(() => {
    // If ending or showing report, disable mic
    if (isEnding || reportData) return;

    if (isSpeakingRef.current || aiStateRef.current === 'THINKING' || queueLengthRef.current > 0) return;

    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechAPI = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechAPI) return;

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

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            handleUserFinishedSpeaking();
        }, 4000); // 4 Seconds wait time
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
  }, [isEnding, reportData]); 

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
    let preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setAiState('SPEAKING');
    
    const handleEnd = () => {
        isSpeakingRef.current = false;
        delete (window as unknown as IWindow).voiceAssistantGlobalUtterance;
        
        setSpeechQueue(prev => {
            const nextQueue = prev.slice(1);
            queueLengthRef.current = nextQueue.length;
            
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

  // --- 4. BUTTONS & ACTIONS ---
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

  // 🆕 END INTERVIEW FUNCTION
  const handleEndInterview = () => {
      if (confirm("Are you sure you want to finish the interview and get your marks?")) {
          stopListening();
          window.speechSynthesis.cancel();
          setSpeechQueue([]);
          setIsEnding(true);
          setAiState('THINKING');
          
          if (socketRef.current?.connected) {
              socketRef.current.emit('end_interview', { sessionId });
          }
      }
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
      {/* 1. START OVERLAY */}
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

      {/* 2. REPORT CARD OVERLAY */}
      {reportData && (
        <div className="voice-overlay">
          <div className="report-card">
             <h2 className="report-title">Interview Results</h2>
             
             <div className="score-circle">
                <span className="score-num">{reportData.score}</span>
                <span className="score-total">/100</span>
             </div>

             <div className="metrics-grid">
                <div className="metric">
                    <span>Communication</span>
                    <div className="bar-bg"><div className="bar-fill" style={{width: `${(reportData.breakdown.communication/30)*100}%`}}></div></div>
                    <span className="metric-val">{reportData.breakdown.communication}/30</span>
                </div>
                <div className="metric">
                    <span>Technical</span>
                    <div className="bar-bg"><div className="bar-fill" style={{width: `${(reportData.breakdown.technical/40)*100}%`}}></div></div>
                    <span className="metric-val">{reportData.breakdown.technical}/40</span>
                </div>
                <div className="metric">
                    <span>Problem Solving</span>
                    <div className="bar-bg"><div className="bar-fill" style={{width: `${(reportData.breakdown.problem_solving/30)*100}%`}}></div></div>
                    <span className="metric-val">{reportData.breakdown.problem_solving}/30</span>
                </div>
             </div>

             <div className="feedback-section">
                <h3>Summary</h3>
                <p>{reportData.feedback_summary}</p>
             </div>
             
             <button onClick={() => window.location.reload()} className="restart-btn">Start New Interview</button>
          </div>
        </div>
      )}

      {/* 3. MAIN HUD */}
      <div className="hud-container">
        
        {/* Loading Spinner for Report */}
        {isEnding && !reportData && (
            <div className="processing-badge">Generating Report...</div>
        )}

        <div className="status-label" style={{ color: getStatusColor() }}>{aiState}</div>
        
        <div className={`orb ${aiState}`}>
          <div className="orb-core"></div>
          <div className="orb-glow"></div>
        </div>
        
        {transcript && <div className="captions-box">You: &quot;{transcript}&quot;</div>}
        
        <div className="controls">
            <button onClick={handleManualReset} className="reset-btn">↻ Reset</button>
            <button onClick={handleEndInterview} className="end-btn">🏁 Finish Interview</button>
        </div>
      </div>

      <style jsx>{`
        .voice-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
        .glass-card { background: rgba(30, 30, 30, 0.95); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 90%; max-width: 400px; }
        
        /* REPORT CARD STYLES */
        .report-card { background: #1e1e1e; padding: 30px; border-radius: 24px; color: white; width: 90%; max-width: 500px; border: 1px solid #333; box-shadow: 0 0 40px rgba(0,0,0,0.8); max-height: 90vh; overflow-y: auto; }
        .report-title { text-align: center; margin-bottom: 20px; font-size: 1.5rem; }
        .score-circle { width: 120px; height: 120px; background: #2563eb; border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 0 auto 25px; box-shadow: 0 0 20px rgba(37, 99, 235, 0.5); }
        .score-num { font-size: 2.5rem; font-weight: 800; line-height: 1; }
        .score-total { font-size: 0.8rem; opacity: 0.8; }
        
        .metrics-grid { display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px; }
        .metric { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
        .metric span:first-child { width: 100px; }
        .bar-bg { flex: 1; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; background: #4ade80; border-radius: 4px; }
        .feedback-section { background: #2a2a2a; padding: 15px; border-radius: 12px; margin-bottom: 20px; }
        .restart-btn { width: 100%; padding: 12px; background: white; color: black; border: none; font-weight: bold; border-radius: 8px; cursor: pointer; }

        .hud-container { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 1000; pointer-events: none; }
        .hud-container button { pointer-events: auto; }
        .status-label { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 12px; color: white; }
        .captions-box { background: rgba(0, 0, 0, 0.7); color: rgba(255, 255, 255, 0.95); padding: 10px 20px; border-radius: 12px; font-size: 0.95rem; max-width: 80vw; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
        
        .start-btn { width: 100%; padding: 14px; font-size: 1rem; font-weight: 600; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; cursor: pointer; margin-top: 15px; }
        .start-btn:disabled { background: #475569; cursor: not-allowed; }
        
        .controls { display: flex; gap: 10px; }
        .reset-btn { padding: 8px 16px; font-size: 0.8rem; border-radius: 8px; border: none; cursor: pointer; background: #ef4444; color: white; opacity: 0.8; }
        .end-btn { padding: 8px 16px; font-size: 0.8rem; border-radius: 8px; border: none; cursor: pointer; background: #10b981; color: white; font-weight: 600; }
        .processing-badge { background: #f59e0b; color: black; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; animation: pulse 1s infinite; }

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