// components/VoiceAssistant.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface VoiceAssistantProps {
  sessionId: string;
  onCodingStart: () => void;
  userId?: string;
  apiEndpoint?: string;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onSocketReady?: (socket: Socket) => void;
}

type AIState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

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
  userId,
  apiEndpoint = 'http://localhost:5001',
  onSpeakingChange,
  onSocketReady,
}: VoiceAssistantProps) {

  const [hasStarted, setHasStarted]             = useState(false);
  const [aiState, setAiState]                   = useState<AIState>('IDLE');
  const [transcript, setTranscript]             = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage]       = useState('Initializing...');
  const [speechQueue, setSpeechQueue]           = useState<string[]>([]);
  const [isEnding, setIsEnding]                 = useState(false);
  const [reportData, setReportData]             = useState<ReportCard | null>(null);

  const aiStateRef       = useRef<AIState>('IDLE');
  const isSpeakingRef    = useRef(false);
  const isRecordingRef   = useRef(false);
  const socketRef        = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const queueLengthRef   = useRef(0);

  const onCodingStartRef    = useRef(onCodingStart);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const onSocketReadyRef    = useRef(onSocketReady);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || apiEndpoint;

  useEffect(() => { aiStateRef.current = aiState; }, [aiState]);
  useEffect(() => { queueLengthRef.current = speechQueue.length; }, [speechQueue]);
  useEffect(() => { onCodingStartRef.current = onCodingStart; }, [onCodingStart]);
  useEffect(() => { onSpeakingChangeRef.current = onSpeakingChange; }, [onSpeakingChange]);
  useEffect(() => { onSocketReadyRef.current = onSocketReady; }, [onSocketReady]);

  useEffect(() => {
    if (onSpeakingChangeRef.current) {
      onSpeakingChangeRef.current(aiState === 'SPEAKING');
    }
  }, [aiState]);

  // --- SOCKET CONNECTION ---
  useEffect(() => {
    if (!sessionId) return;
    if (socketRef.current?.connected) return;

    setConnectionStatus('connecting');
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(apiUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setStatusMessage('Connected.');
      if (onSocketReadyRef.current) onSocketReadyRef.current(socket);
    });

    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => {
      setConnectionStatus('error');
      setStatusMessage('Could not connect to server.');
    });

    socket.on('ai_speak', (data: { text: string }) => {
      setTranscript('');
      setSpeechQueue(prev => {
        const next = [...prev, data.text];
        queueLengthRef.current = next.length;
        return next;
      });
    });

    socket.on('start_coding_phase', () => {
      setSpeechQueue(prev => [...prev, "Let's move to the coding challenge."]);
      setTimeout(() => { onCodingStartRef.current?.(); }, 4000);
    });

    socket.on('feedback_processing', () => {
      setIsEnding(true);
      setStatusMessage('Generating your report...');
    });

    socket.on('interview_results', (data: ReportCard) => {
      setIsEnding(false);
      setReportData(data);
      stopSpeaking();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, apiUrl]);

  // --- STOP SPEAKING (browser speechSynthesis) ---
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
  }, []);

  // --- GET MICROPHONE ---
  const initMicrophone = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Microphone access denied:', err);
      setAiState('ERROR');
      setStatusMessage('Microphone blocked — please allow access.');
      return null;
    }
  }, []);

  // --- START LISTENING ---
  const startListening = useCallback(async () => {
    if (isEnding || reportData) return;
    if (isSpeakingRef.current || aiStateRef.current === 'THINKING' || queueLengthRef.current > 0) return;
    if (isRecordingRef.current) return;

    const stream = await initMicrophone();
    if (!stream) return;

    audioChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      if (audioBlob.size < 1000) {
        setTimeout(() => startListening(), 300);
        return;
      }

      setAiState('THINKING');
      setStatusMessage('Transcribing...');

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const res = await fetch(`${apiUrl}/api/interview/stt`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(`STT failed: ${res.status}`);

        const data = await res.json();
        const text = data.text?.trim();

        if (!text) {
          setAiState('IDLE');
          setTimeout(() => startListening(), 300);
          return;
        }

        setTranscript(text);
        setStatusMessage('Thinking...');

        if (socketRef.current?.connected) {
          socketRef.current.emit('user_speak', { text, sessionId });
        }
      } catch (err) {
        console.error('STT Error:', err);
        setStatusMessage('Transcription failed — retrying...');
        setAiState('IDLE');
        setTimeout(() => startListening(), 1000);
      }
    };

    recorder.start(250);
    isRecordingRef.current = true;
    setAiState('LISTENING');
    setStatusMessage('Listening...');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => stopListening(), 6000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnding, reportData, sessionId, apiUrl, initMicrophone]);

  // --- STOP LISTENING ---
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, []);

  // =================================================================
  // SPEAK TEXT — Browser Web Speech API (FREE, no API needed)
  // Replaces OpenAI TTS — works in all modern browsers
  // =================================================================
  const speakText = useCallback((text: string) => {
    if (!text) {
      setSpeechQueue(prev => {
        const next = prev.slice(1);
        queueLengthRef.current = next.length;
        if (next.length === 0) setTimeout(() => startListening(), 300);
        return next;
      });
      return;
    }

    // Cancel any ongoing speech first
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    isSpeakingRef.current = true;
    stopListening();
    setAiState('SPEAKING');
    setStatusMessage('Speaking...');

    const utterance = new SpeechSynthesisUtterance(text);

    // Voice settings — pick best available English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(v => v.name.includes('Google UK English Female')) ||
      voices.find(v => v.name.includes('Samantha')) ||           // macOS
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.lang === 'en-US' && !v.localService) || // remote = better quality
      voices.find(v => v.lang.startsWith('en')) ||
      null;

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate   = 0.95;  // slightly slower = clearer
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;
    utterance.lang   = 'en-US';

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setSpeechQueue(prev => {
        const next = prev.slice(1);
        queueLengthRef.current = next.length;
        if (next.length === 0) {
          setAiState('IDLE');
          setTranscript('');
          setTimeout(() => startListening(), 300);
        }
        return next;
      });
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      isSpeakingRef.current = false;
      setSpeechQueue(prev => {
        const next = prev.slice(1);
        queueLengthRef.current = next.length;
        if (next.length === 0) {
          setAiState('IDLE');
          setTimeout(() => startListening(), 500);
        }
        return next;
      });
    };

    // Chrome bug fix — voices sometimes not loaded yet
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.speak(utterance);
      };
    } else {
      window.speechSynthesis.speak(utterance);
    }

  }, [startListening, stopListening]);

  // Play next item in speech queue
  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeakingRef.current) {
      speakText(speechQueue[0]);
    }
  }, [speechQueue, speakText]);

  // --- BUTTON HANDLERS ---
  const handleStartInteraction = () => {
    setHasStarted(true);
    setAiState('IDLE');
    socketRef.current?.emit('start_voice_interview', { sessionId });
  };

  const handleManualReset = () => {
    stopSpeaking();
    stopListening();
    isSpeakingRef.current = false;
    isRecordingRef.current = false;
    setSpeechQueue([]);
    setAiState('IDLE');
    setTimeout(() => startListening(), 500);
  };

  const handleEndInterview = () => {
    if (!confirm('Are you sure you want to finish the interview and get your results?')) return;
    stopListening();
    stopSpeaking();
    setSpeechQueue([]);
    setIsEnding(true);
    setAiState('THINKING');
    socketRef.current?.emit('end_interview', {
      sessionId,
      userId: userId || 'GUEST_USER',
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = () => {
    switch (aiState) {
      case 'SPEAKING':  return '#3b82f6';
      case 'LISTENING': return '#4ade80';
      case 'THINKING':  return '#f59e0b';
      case 'ERROR':     return '#ef4444';
      default:          return '#94a3b8';
    }
  };

  return (
    <>
      {/* START OVERLAY */}
      {!hasStarted && (
        <div className="voice-overlay">
          <div className="glass-card">
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤖</div>
            <h2>AI Interviewer Ready</h2>
            <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '10px' }}>
              Voice powered by browser speech · STT by Groq Whisper
            </p>
            <button
              onClick={handleStartInteraction}
              className="start-btn"
              disabled={connectionStatus !== 'connected'}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'error'      ? 'Connection failed — refresh' :
               '🎙️ Begin Interview'}
            </button>
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#555' }}>
              Status: <span style={{ color: connectionStatus === 'connected' ? '#4ade80' : '#f87171' }}>
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT CARD OVERLAY */}
      {reportData && (
        <div className="voice-overlay">
          <div className="report-card">
            <h2 className="report-title">Interview Results</h2>

            <div className="score-circle">
              <span className="score-num">{reportData.score}</span>
              <span className="score-total">/100</span>
            </div>

            <div className="metrics-grid">
              {[
                { label: 'Communication',   val: reportData.breakdown.communication,   max: 30 },
                { label: 'Technical',        val: reportData.breakdown.technical,        max: 40 },
                { label: 'Problem Solving',  val: reportData.breakdown.problem_solving,  max: 30 },
              ].map(m => (
                <div key={m.label} className="metric">
                  <span>{m.label}</span>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: `${(m.val / m.max) * 100}%` }} />
                  </div>
                  <span className="metric-val">{m.val}/{m.max}</span>
                </div>
              ))}
            </div>

            {reportData.key_strengths?.length > 0 && (
              <div className="feedback-section">
                <h3>Strengths</h3>
                <ul>{reportData.key_strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {reportData.areas_for_improvement?.length > 0 && (
              <div className="feedback-section">
                <h3>To improve</h3>
                <ul>{reportData.areas_for_improvement.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}

            <div className="feedback-section">
              <h3>Summary</h3>
              <p>{reportData.feedback_summary}</p>
            </div>

            <button onClick={() => window.location.reload()} className="restart-btn">
              Start New Interview
            </button>
          </div>
        </div>
      )}

      {/* MAIN HUD */}
      <div className="hud-container">
        {isEnding && !reportData && (
          <div className="processing-badge">⏳ Generating Report...</div>
        )}

        <div className="status-label" style={{ color: getStatusColor() }}>
          {aiState}
        </div>

        <div className={`orb ${aiState}`}>
          <div className="orb-core" />
          <div className="orb-glow" />
        </div>

        {transcript && (
          <div className="captions-box">You: &quot;{transcript}&quot;</div>
        )}

        <div className="controls">
          <button onClick={handleManualReset} className="reset-btn">↻ Reset</button>
          <button onClick={handleEndInterview} className="end-btn">🏁 Finish Interview</button>
        </div>
      </div>

      <style jsx>{`
        .voice-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          display: flex; justify-content: center; align-items: center;
          z-index: 9999;
        }
        .glass-card {
          background: rgba(15,15,20,0.95);
          padding: 40px; border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.1);
          text-align: center; color: white;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
          width: 90%; max-width: 400px;
        }
        .glass-card h2 { margin: 0 0 8px; font-size: 1.3rem; }

        .report-card {
          background: #0f0f14; padding: 30px; border-radius: 24px;
          color: white; width: 90%; max-width: 500px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 0 60px rgba(0,0,0,0.8);
          max-height: 90vh; overflow-y: auto;
        }
        .report-title { text-align: center; margin-bottom: 20px; font-size: 1.4rem; font-weight: 700; }
        .score-circle {
          width: 120px; height: 120px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border-radius: 50%;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          margin: 0 auto 25px;
          box-shadow: 0 0 30px rgba(124,58,237,0.4);
        }
        .score-num { font-size: 2.5rem; font-weight: 800; line-height: 1; }
        .score-total { font-size: 0.8rem; opacity: 0.7; }
        .metrics-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
        .metric { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; }
        .metric span:first-child { width: 120px; flex-shrink: 0; color: rgba(255,255,255,0.6); }
        .metric-val { width: 46px; text-align: right; flex-shrink: 0; font-weight: 600; }
        .bar-bg { flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
        .bar-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #4ade80); border-radius: 3px; transition: width 0.6s ease; }
        .feedback-section {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 14px 16px; border-radius: 12px; margin-bottom: 12px;
        }
        .feedback-section h3 {
          font-size: 0.72rem; text-transform: uppercase;
          letter-spacing: 1px; color: rgba(255,255,255,0.35);
          margin: 0 0 8px;
        }
        .feedback-section ul { padding-left: 16px; margin: 0; }
        .feedback-section li { margin-bottom: 4px; font-size: 0.88rem; color: rgba(255,255,255,0.75); }
        .feedback-section p { margin: 0; font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.6; }
        .restart-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white; border: none; font-weight: 700;
          border-radius: 12px; cursor: pointer; margin-top: 8px;
          font-size: 0.95rem;
        }

        .hud-container {
          position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; z-index: 1000; pointer-events: none;
        }
        .hud-container button { pointer-events: auto; }
        .status-label {
          font-size: 0.78rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 2px;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          padding: 4px 14px; border-radius: 12px;
        }
        .captions-box {
          background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
          color: rgba(255,255,255,0.9); padding: 10px 20px;
          border-radius: 12px; font-size: 0.9rem;
          max-width: 80vw; text-align: center;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .start-btn {
          width: 100%; padding: 14px; font-size: 1rem; font-weight: 600;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white; border: none; border-radius: 12px;
          cursor: pointer; margin-top: 16px; transition: opacity 0.2s;
        }
        .start-btn:hover:not(:disabled) { opacity: 0.9; }
        .start-btn:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
        .controls { display: flex; gap: 10px; }
        .reset-btn {
          padding: 8px 16px; font-size: 0.8rem;
          border-radius: 8px; border: none; cursor: pointer;
          background: rgba(239,68,68,0.8); color: white;
        }
        .end-btn {
          padding: 8px 16px; font-size: 0.8rem;
          border-radius: 8px; border: none; cursor: pointer;
          background: rgba(16,185,129,0.9); color: white; font-weight: 600;
        }
        .processing-badge {
          background: #f59e0b; color: black;
          padding: 5px 16px; border-radius: 20px;
          font-weight: 700; font-size: 0.78rem;
          animation: pulse 1s infinite;
        }
        .orb {
          width: 80px; height: 80px; position: relative;
          display: flex; justify-content: center; align-items: center;
        }
        .orb-core {
          width: 40px; height: 40px;
          background: #fff; border-radius: 50%;
          z-index: 10; transition: background 0.3s;
        }
        .orb-glow {
          position: absolute; width: 100%; height: 100%;
          border-radius: 50%; z-index: 1;
          filter: blur(20px); opacity: 0.5; transition: all 0.3s;
        }
        .orb.IDLE     .orb-core { background: #94a3b8; }
        .orb.LISTENING .orb-core { background: #4ade80; }
        .orb.LISTENING .orb-glow { background: #22c55e; transform: scale(1.2); }
        .orb.THINKING  .orb-core { background: #f59e0b; }
        .orb.SPEAKING  .orb-core { background: #7c3aed; }
        .orb.SPEAKING  .orb-glow { background: #7c3aed; animation: speakPulse 0.8s infinite; }
        .orb.ERROR     .orb-core { background: #ef4444; }

        @keyframes speakPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%       { transform: scale(1.4); opacity: 0.9; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}