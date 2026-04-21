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
  onDifficultyChange?: (level: string) => void;
  onCheatEvent?: (type: string, detail?: string) => void;
  resumeContext?: string;
}

type AIState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface ReportCard {
  score: number;
  breakdown: { communication: number; technical: number; problem_solving: number };
  feedback_summary: string;
  key_strengths: string[];
  areas_for_improvement: string[];
  cheatingFlags?: number;
}

const VERBAL_DURATION_SECONDS = 10 * 60;

export default function VoiceAssistant({
  sessionId,
  onCodingStart,
  userId,
  apiEndpoint = 'http://localhost:5001',
  onSpeakingChange,
  onSocketReady,
  onDifficultyChange,
  onCheatEvent,
  resumeContext,
}: VoiceAssistantProps) {

  const [hasStarted, setHasStarted]               = useState(false);
  const [aiState, setAiState]                     = useState<AIState>('IDLE');
  const [transcript, setTranscript]               = useState('');
  const [liveTranscript, setLiveTranscript]       = useState('');
  const [connectionStatus, setConnectionStatus]   = useState<ConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage]         = useState('Initializing...');
  const [speechQueue, setSpeechQueue]             = useState<string[]>([]);
  const [isEnding, setIsEnding]                   = useState(false);
  const [reportData, setReportData]               = useState<ReportCard | null>(null);
  const [isTerminated, setIsTerminated]           = useState(false);
  const [terminatedMessage, setTerminatedMessage] = useState('');
  const [verbalTimeLeft, setVerbalTimeLeft]       = useState(VERBAL_DURATION_SECONDS);
  const [verbalTimerActive, setVerbalTimerActive] = useState(false);
  const [silenceSeconds, setSilenceSeconds]       = useState(0);
  const [waveHeights, setWaveHeights]             = useState([4, 4, 4, 4, 4]);

  const aiStateRef       = useRef<AIState>('IDLE');
  const isSpeakingRef    = useRef(false);
  const isRecordingRef   = useRef(false);
  const socketRef        = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silencePollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const queueLengthRef   = useRef(0);
  const verbalTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceCountRef  = useRef(0);
  const waveRafRef       = useRef<number | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  // ref for currently playing TTS audio (ElevenLabs / OpenAI)
  const audioRef         = useRef<HTMLAudioElement | null>(null);

  const onCodingStartRef    = useRef(onCodingStart);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const onSocketReadyRef    = useRef(onSocketReady);
  const onDifficultyRef     = useRef(onDifficultyChange);

  const apiUrl    = process.env.NEXT_PUBLIC_API_URL    || apiEndpoint;
  // Java backend runs Socket.IO on a separate port (5002) via netty-socketio.
  // Falls back to apiUrl so the single-port Node setup still works if needed.
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || apiUrl;

  useEffect(() => { aiStateRef.current = aiState; }, [aiState]);
  useEffect(() => { queueLengthRef.current = speechQueue.length; }, [speechQueue]);
  useEffect(() => { onCodingStartRef.current = onCodingStart; }, [onCodingStart]);
  useEffect(() => { onSpeakingChangeRef.current = onSpeakingChange; }, [onSpeakingChange]);
  useEffect(() => { onSocketReadyRef.current = onSocketReady; }, [onSocketReady]);
  useEffect(() => { onDifficultyRef.current = onDifficultyChange; }, [onDifficultyChange]);

  useEffect(() => {
    if (onSpeakingChangeRef.current) {
      onSpeakingChangeRef.current(aiState === 'SPEAKING');
    }
  }, [aiState]);

  // ------------------------------------------------------------------
  // VERBAL TIMER
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!verbalTimerActive) return;
    if (verbalTimerRef.current) clearInterval(verbalTimerRef.current);
    verbalTimerRef.current = setInterval(() => {
      setVerbalTimeLeft(prev => {
        if (prev <= 1) { clearInterval(verbalTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (verbalTimerRef.current) clearInterval(verbalTimerRef.current); };
  }, [verbalTimerActive]);

  useEffect(() => {
    if (aiState !== 'LISTENING') {
      setSilenceSeconds(0); silenceCountRef.current = 0; return;
    }
    const t = setInterval(() => {
      silenceCountRef.current++;
      setSilenceSeconds(silenceCountRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [aiState]);

  // ------------------------------------------------------------------
  // SOCKET
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;
    if (socketRef.current?.connected) return;

    setConnectionStatus('connecting');
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'], // polling first avoids noisy WS failure on initial connect
      reconnectionAttempts: 5,
      auth: userId ? { userId } : {},
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

    socket.on('ai_speak', (data: { text: string; difficulty_level?: string; time_remaining_seconds?: number }) => {
      setTranscript(''); setLiveTranscript('');
      setSpeechQueue(prev => {
        const next = [...prev, data.text];
        queueLengthRef.current = next.length;
        return next;
      });
      if (data.difficulty_level && onDifficultyRef.current) onDifficultyRef.current(data.difficulty_level);
      if (data.time_remaining_seconds !== undefined) setVerbalTimeLeft(data.time_remaining_seconds);
    });

    socket.on('verbal_timer_start', (data: { durationMs: number; remainingMs?: number }) => {
      const remainSecs = data.remainingMs
        ? Math.ceil(data.remainingMs / 1000)
        : Math.ceil(data.durationMs / 1000);
      setVerbalTimeLeft(remainSecs);
      setVerbalTimerActive(true);
    });

    socket.on('interview_terminated', (data: { reason: string; message: string }) => {
      stopSpeaking(); stopListening();
      setSpeechQueue([]); setVerbalTimerActive(false);
      setIsTerminated(true); setTerminatedMessage(data.message);
    });

    socket.on('verbal_time_up', () => {
      setSpeechQueue(prev => [...prev, 'Time is up for the verbal round. Let us now proceed to the coding challenge.']);
    });

    socket.on('start_coding_phase', () => {
      setSpeechQueue(prev => [...prev, "Let's move to the coding challenge."]);
      setVerbalTimerActive(false);
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

    return () => { socket.removeAllListeners(); socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, apiUrl]);

  // ------------------------------------------------------------------
  // WAVEFORM
  // ------------------------------------------------------------------
  const startWaveform = useCallback((stream: MediaStream) => {
    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 32;
      source.connect(analyserRef.current);
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const bars = [0, 1, 2, 3, 4].map(i => {
          const val = data[Math.floor(i * data.length / 5)] || 0;
          return Math.max(4, Math.min(28, (val / 255) * 28));
        });
        setWaveHeights(bars);
        waveRafRef.current = requestAnimationFrame(draw);
      };
      waveRafRef.current = requestAnimationFrame(draw);
    } catch { /* ignore */ }
  }, []);

  const stopWaveform = useCallback(() => {
    if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);
    setWaveHeights([4, 4, 4, 4, 4]);
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null; analyserRef.current = null;
  }, []);

  // ------------------------------------------------------------------
  // STOP SPEAKING — OpenAI TTS audio
  // ------------------------------------------------------------------
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
  }, []);

  // ------------------------------------------------------------------
  // MICROPHONE
  // ------------------------------------------------------------------
  const initMicrophone = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch {
      setAiState('ERROR');
      setStatusMessage('Microphone blocked — please allow access.');
      return null;
    }
  }, []);

  // ------------------------------------------------------------------
  // STOP LISTENING
  // ------------------------------------------------------------------
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current)  { clearTimeout(silenceTimerRef.current);  silenceTimerRef.current  = null; }
    if (silencePollRef.current)   { clearInterval(silencePollRef.current);   silencePollRef.current   = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    stopWaveform();
  }, [stopWaveform]);

  // ------------------------------------------------------------------
  // START LISTENING
  // ------------------------------------------------------------------
  const startListening = useCallback(async () => {
    if (isEnding || reportData) return;
    if (isSpeakingRef.current || aiStateRef.current === 'THINKING' || queueLengthRef.current > 0) return;
    if (isRecordingRef.current) return;

    const stream = await initMicrophone();
    if (!stream) return;

    startWaveform(stream);
    audioChunksRef.current = [];

    const baseMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' 
      : MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: baseMime });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      stopWaveform();
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });

      if (audioBlob.size < 1000) { setTimeout(() => startListening(), 300); return; }

      setAiState('THINKING');
      setStatusMessage('Transcribing...');
      setLiveTranscript('');

      try {
        const formData = new FormData();
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        formData.append('audio', audioBlob, `recording.${ext}`);
        const res = await fetch(`${apiUrl}/api/interview/stt`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`STT failed: ${res.status}`);
        const data = await res.json();
        const text = data.text?.trim();

        if (!text) { setAiState('IDLE'); setTimeout(() => startListening(), 300); return; }

        setTranscript(text);
        setStatusMessage('Thinking...');
        silenceCountRef.current = 0;

        if (socketRef.current?.connected) {
          socketRef.current.emit('user_speak', { text, sessionId, timeRemaining: verbalTimeLeft });
        }
      } catch {
        setStatusMessage('Transcription failed — retrying...');
        setAiState('IDLE');
        setTimeout(() => startListening(), 1000);
      }
    };

    recorder.start();
    isRecordingRef.current = true;
    setAiState('LISTENING');
    setStatusMessage('Listening...');
    setLiveTranscript('');

    // ----------------------------------------------------------------
    // Voice-activity-aware silence detection
    //
    // Instead of a fixed cutoff timer, we poll the audio analyser every
    // 200ms.  While the user is speaking (RMS above threshold) the
    // silence counter resets.  Only after SILENCE_LIMIT consecutive
    // quiet polls AND at least MIN_SPEECH_MS has elapsed do we stop.
    // MAX_DURATION_MS is the absolute hard cap.
    // ----------------------------------------------------------------
    const SILENCE_LIMIT   = 15;   // ~3 s of continuous silence (15 × 200 ms)
    const MIN_SPEECH_MS   = 2000; // don't cut off before 2 s have elapsed
    const MAX_DURATION_MS = 45000; // hard cap: 45 s max per turn
    const SPEECH_THRESHOLD = 8;   // RMS value (0-255) considered "voice"

    const recordingStart = Date.now();
    let silentPolls = 0;
    let userSpokeAtLeastOnce = false;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // Absolute hard-cap timer
    const hardCapTimer = setTimeout(() => {
      if (isRecordingRef.current) stopListening();
    }, MAX_DURATION_MS);
    silenceTimerRef.current = hardCapTimer;

    const pollInterval = setInterval(() => {
      if (!isRecordingRef.current) { clearInterval(pollInterval); silencePollRef.current = null; return; }

      const elapsed = Date.now() - recordingStart;

      // Read current audio level from the analyser (already running for waveform)
      let rms = 0;
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const sum = buf.reduce((a, b) => a + b, 0);
        rms = sum / buf.length;
      }

      if (rms > SPEECH_THRESHOLD) {
        // User is speaking — reset silence counter
        silentPolls = 0;
        userSpokeAtLeastOnce = true;
      } else {
        silentPolls++;
      }

      // Stop when: past minimum time AND (long silence OR user spoke then went quiet)
      const longEnough = elapsed >= MIN_SPEECH_MS;
      const silenceDetected = silentPolls >= SILENCE_LIMIT;
      const spokeThenQuiet  = userSpokeAtLeastOnce && silentPolls >= 10; // ~2 s quiet after speech

      if (longEnough && (silenceDetected || spokeThenQuiet)) {
        clearInterval(pollInterval);
        silencePollRef.current = null;
        clearTimeout(hardCapTimer);
        silenceTimerRef.current = null;
        if (isRecordingRef.current) stopListening();
      }
    }, 200);
    silencePollRef.current = pollInterval;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnding, reportData, sessionId, apiUrl, initMicrophone, stopListening, startWaveform, stopWaveform, verbalTimeLeft]);

  // ------------------------------------------------------------------
  // SPEAK TEXT — ElevenLabs primary → OpenAI TTS → browser speech
  // ------------------------------------------------------------------
  const speakText = useCallback(async (text: string) => {
    if (!text) {
      setSpeechQueue(prev => {
        const next = prev.slice(1);
        queueLengthRef.current = next.length;
        if (next.length === 0) setTimeout(() => startListening(), 300);
        return next;
      });
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    isSpeakingRef.current = true;
    stopListening();
    setAiState('SPEAKING');
    setStatusMessage('Speaking...');

    const handleEnd = () => {
      isSpeakingRef.current = false;
      audioRef.current = null;
      setSpeechQueue(prev => {
        const next = prev.slice(1);
        queueLengthRef.current = next.length;
        if (next.length === 0) {
          setAiState('IDLE');
          setTranscript('');
          setTimeout(() => startListening(), 400);
        }
        return next;
      });
    };

    try {
      // Call OpenAI TTS via backend
      const res = await fetch(`${apiUrl}/api/interview/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'onyx' }), // onyx = deep professional male voice
      });

      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const audioBlob = await res.blob();

      // Empty buffer = backend intentionally fell back (Groq provider has no TTS)
      // Silently use browser speech — not an error
      if (audioBlob.size < 100) {
        console.info('[TTS] Empty buffer received — using browser speech fallback.');
        throw new Error('SILENT_FALLBACK');
      }

      const audioUrl  = URL.createObjectURL(audioBlob);
      const audio     = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        handleEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        handleEnd();
      };

      await audio.play();

    } catch (err: any) {
      // Only log as error if it's a real failure, not an intentional silent fallback
      if (err?.message !== 'SILENT_FALLBACK') {
        console.error('❌ TTS Error — falling back to browser speech:', err);
      }

      // FALLBACK: browser speech if OpenAI TTS fails
      isSpeakingRef.current = true;
      const utterance = new SpeechSynthesisUtterance(text);
      const voices    = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.name.includes('Google UK English Male')) ||
        voices.find(v => v.name.includes('Daniel')) ||
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en')) || null;

      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.92; utterance.pitch = 1.0; utterance.volume = 1.0;

      utterance.onend  = handleEnd;
      utterance.onerror = handleEnd;

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.speak(utterance);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [apiUrl, startListening, stopListening]);

  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeakingRef.current) speakText(speechQueue[0]);
  }, [speechQueue, speakText]);

  // ------------------------------------------------------------------
  // BUTTON HANDLERS
  // ------------------------------------------------------------------
  const handleStartInteraction = () => {
    setHasStarted(true);
    setAiState('IDLE');
    setVerbalTimerActive(true);
    socketRef.current?.emit('start_voice_interview', { sessionId, resumeContext });
  };

  const handleEndInterview = () => {
    if (!confirm('End interview and get your results?')) return;
    stopListening(); stopSpeaking();
    setSpeechQueue([]); setIsEnding(true); setAiState('THINKING');
    setVerbalTimerActive(false);
    socketRef.current?.emit('end_interview', { sessionId, userId: userId || 'GUEST_USER' });
  };

  const handleManualReset = () => {
    stopSpeaking(); stopListening();
    isSpeakingRef.current = false; isRecordingRef.current = false;
    setSpeechQueue([]); setAiState('IDLE');
    setTimeout(() => startListening(), 500);
  };

  useEffect(() => {
    if (!onCheatEvent) return;
    const handler = (type: string, detail?: string) => {
      socketRef.current?.emit('cheat_event', { sessionId, type, detail });
    };
    (window as any).__reportCheat = handler;
  }, [sessionId, onCheatEvent]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopSpeaking(); stopListening(); stopWaveform();
      if (verbalTimerRef.current) clearInterval(verbalTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------
  const formatVerbalTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const timerColor   = verbalTimeLeft <= 120 ? '#f87171' : verbalTimeLeft <= 300 ? '#facc15' : '#4ade80';
  const getStateColor = () => {
    switch (aiState) {
      case 'SPEAKING':  return '#a855f7';
      case 'LISTENING': return '#4ade80';
      case 'THINKING':  return '#f59e0b';
      case 'ERROR':     return '#ef4444';
      default:          return '#475569';
    }
  };

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <>
      {/* TERMINATED OVERLAY */}
      {isTerminated && (
        <div className="overlay">
          <div className="terminated-card">
            <div className="terminated-icon">🚫</div>
            <h2>Interview Terminated</h2>
            <p>{terminatedMessage || 'The interview has been terminated due to a violation of interview integrity.'}</p>
            <button onClick={() => window.location.href = '/'} className="restart-btn">
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* START OVERLAY */}
      {!hasStarted && (
        <div className="overlay">
          <div className="start-card">
            <div className="card-icon">🤖</div>
            <h2>AI Interviewer Ready</h2>
            <p>Powered by ElevenLabs · GPT-4o · Whisper</p>
            {resumeContext && (
              <div className="resume-indicator">
                ✅ Resume loaded — personalized questions enabled
              </div>
            )}
            <button
              onClick={handleStartInteraction}
              className="begin-btn"
              disabled={connectionStatus !== 'connected'}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'error'      ? 'Connection failed — refresh' :
               '🎙️ Begin Interview'}
            </button>
            <div className="conn-status">
              <span className={`conn-dot ${connectionStatus}`} />
              {connectionStatus}
            </div>
          </div>
        </div>
      )}

      {/* REPORT OVERLAY */}
      {reportData && (
        <div className="overlay">
          <div className="report-card">
            <h2>Interview Complete</h2>
            <div className="score-circle">
              <span className="score-num">{reportData.score}</span>
              <span className="score-label">/100</span>
            </div>
            <div className="breakdown">
              {[
                { label: 'Communication',   val: reportData.breakdown.communication,   max: 30 },
                { label: 'Technical',       val: reportData.breakdown.technical,        max: 40 },
                { label: 'Problem Solving', val: reportData.breakdown.problem_solving,  max: 30 },
              ].map(m => (
                <div key={m.label} className="metric-row">
                  <span className="metric-label">{m.label}</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: `${(m.val / m.max) * 100}%` }} />
                  </div>
                  <span className="metric-val">{m.val}/{m.max}</span>
                </div>
              ))}
            </div>
            {(reportData.cheatingFlags ?? 0) > 0 && (
              <div className="cheat-notice">⚠️ {reportData.cheatingFlags} integrity flag(s) logged</div>
            )}
            {reportData.key_strengths?.length > 0 && (
              <div className="section"><h3>Strengths</h3>
                <ul>{reportData.key_strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {reportData.areas_for_improvement?.length > 0 && (
              <div className="section"><h3>To improve</h3>
                <ul>{reportData.areas_for_improvement.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            <div className="section"><h3>Summary</h3><p>{reportData.feedback_summary}</p></div>
            <button onClick={() => window.location.reload()} className="restart-btn">
              Start New Interview
            </button>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="hud">
        {isEnding && !reportData && (
          <div className="processing">⏳ Generating report...</div>
        )}
        {hasStarted && !reportData && !isEnding && (
          <div className="verbal-timer" style={{ color: timerColor }}>
            <span className="timer-icon">⏱</span>
            <span className="timer-val">{formatVerbalTime(verbalTimeLeft)}</span>
            <span className="timer-label">verbal</span>
            {verbalTimeLeft <= 120 && <span className="timer-warn">Ending soon</span>}
          </div>
        )}
        {aiState === 'LISTENING' && (
          <div className="waveform">
            {waveHeights.map((h, i) => (
              <div key={i} className="wave-bar" style={{ height: `${h}px` }} />
            ))}
          </div>
        )}
        <div className="state-pill" style={{ color: getStateColor(), borderColor: `${getStateColor()}30` }}>
          <span className="state-dot" style={{ background: getStateColor() }} />
          {aiState}
          {aiState === 'LISTENING' && silenceSeconds > 3 && (
            <span className="silence-warn">{silenceSeconds}s</span>
          )}
        </div>
        {transcript && (
          <div className="caption">
            <span className="caption-label">You:</span>
            &quot;{transcript}&quot;
          </div>
        )}
        <div className="controls">
          <button onClick={handleManualReset} className="ctrl-btn reset">↻</button>
          <button onClick={handleEndInterview} className="ctrl-btn end">🏁 Finish</button>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
        }
        .terminated-card {
          background: rgba(10,10,16,0.98);
          border: 1px solid rgba(248,113,113,0.3);
          border-radius: 24px; padding: 48px 40px;
          width: 90%; max-width: 440px;
          text-align: center; color: white;
        }
        .terminated-icon { font-size: 3rem; margin-bottom: 16px; }
        .terminated-card h2 { margin: 0 0 12px; font-size: 1.4rem; color: #f87171; }
        .terminated-card p { color: rgba(255,255,255,0.55); font-size: 0.9rem; line-height: 1.7; margin: 0 0 28px; }
        .start-card {
          background: rgba(10,10,16,0.96);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px; padding: 40px 36px;
          width: 90%; max-width: 420px;
          text-align: center; color: white;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6);
        }
        .card-icon { font-size: 2.5rem; margin-bottom: 12px; }
        .start-card h2 { margin: 0 0 8px; font-size: 1.3rem; font-weight: 700; }
        .start-card p { color: rgba(255,255,255,0.4); font-size: 0.85rem; margin: 0 0 16px; }
        .resume-indicator {
          background: rgba(74,222,128,0.08);
          border: 1px solid rgba(74,222,128,0.2);
          color: #4ade80; border-radius: 8px;
          padding: 8px 12px; font-size: 0.8rem; margin-bottom: 16px;
        }
        .begin-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          color: white; border: none; border-radius: 12px;
          font-size: 1rem; font-weight: 700; cursor: pointer;
          transition: opacity 0.2s;
        }
        .begin-btn:hover:not(:disabled) { opacity: 0.9; }
        .begin-btn:disabled { background: #1e1e2a; color: #444; cursor: not-allowed; }
        .conn-status {
          margin-top: 12px; font-size: 0.75rem;
          color: rgba(255,255,255,0.3);
          display: flex; align-items: center; gap: 5px; justify-content: center;
        }
        .conn-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .conn-dot.connected    { background: #4ade80; }
        .conn-dot.connecting   { background: #f59e0b; animation: blink 1s infinite; }
        .conn-dot.disconnected,
        .conn-dot.error        { background: #f87171; }
        .report-card {
          background: #0a0a10;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px; padding: 32px;
          width: 90%; max-width: 500px;
          max-height: 90vh; overflow-y: auto; color: white;
        }
        .report-card h2 { text-align: center; margin: 0 0 20px; font-size: 1.3rem; }
        .score-circle {
          width: 110px; height: 110px;
          background: linear-gradient(135deg,#7c3aed,#2563eb);
          border-radius: 50%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          margin: 0 auto 24px;
        }
        .score-num { font-size: 2.4rem; font-weight: 800; line-height: 1; }
        .score-label { font-size: 0.75rem; opacity: 0.6; }
        .breakdown { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .metric-row { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; }
        .metric-label { width: 120px; flex-shrink: 0; color: rgba(255,255,255,0.5); }
        .metric-bar { flex: 1; height: 5px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }
        .metric-fill { height: 100%; background: linear-gradient(90deg,#7c3aed,#4ade80); border-radius: 3px; }
        .metric-val { width: 44px; text-align: right; font-weight: 600; font-size: 0.82rem; }
        .cheat-notice {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5; padding: 8px 12px; border-radius: 8px;
          font-size: 0.8rem; margin-bottom: 14px;
        }
        .section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
        }
        .section h3 { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.3); margin: 0 0 8px; }
        .section ul { padding-left: 16px; margin: 0; }
        .section li { font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 3px; }
        .section p  { font-size: 0.85rem; color: rgba(255,255,255,0.55); line-height: 1.6; margin: 0; }
        .restart-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          color: white; border: none; border-radius: 10px;
          font-weight: 700; cursor: pointer; font-size: 0.95rem; margin-top: 6px;
        }
        .hud {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; z-index: 1000; pointer-events: none;
        }
        .hud button { pointer-events: auto; }
        .processing {
          background: #f59e0b; color: black;
          padding: 4px 14px; border-radius: 20px;
          font-weight: 700; font-size: 0.75rem;
          animation: blink 1s infinite;
        }
        .verbal-timer {
          display: flex; align-items: center; gap: 5px;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 4px 14px; border-radius: 20px;
          font-size: 0.8rem; font-weight: 700; transition: color 0.5s;
        }
        .timer-icon { font-size: 0.75rem; }
        .timer-val  { font-family: 'SF Mono', monospace; }
        .timer-label { font-size: 0.65rem; opacity: 0.5; font-weight: 400; }
        .timer-warn {
          font-size: 0.62rem; background: currentColor;
          color: black; padding: 1px 6px; border-radius: 4px; font-weight: 800;
        }
        .waveform {
          display: flex; align-items: center; gap: 3px;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          padding: 8px 16px; border-radius: 24px;
          border: 1px solid rgba(74,222,128,0.2);
        }
        .wave-bar {
          width: 3px; background: #4ade80; border-radius: 2px;
          transition: height 0.08s ease; min-height: 4px;
        }
        .state-pill {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 2px;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
          padding: 4px 14px; border-radius: 12px; border: 1px solid;
        }
        .state-dot { width: 6px; height: 6px; border-radius: 50%; }
        .silence-warn {
          background: rgba(245,158,11,0.2); color: #f59e0b;
          padding: 1px 6px; border-radius: 4px; font-size: 0.62rem;
        }
        .caption {
          background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
          color: rgba(255,255,255,0.85); padding: 8px 18px;
          border-radius: 10px; font-size: 0.88rem;
          max-width: 80vw; text-align: center;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .caption-label { color: rgba(255,255,255,0.35); margin-right: 5px; font-size: 0.78rem; }
        .controls { display: flex; gap: 8px; }
        .ctrl-btn {
          padding: 7px 14px; font-size: 0.78rem;
          border-radius: 8px; border: none; cursor: pointer; font-weight: 600;
        }
        .ctrl-btn.reset { background: rgba(100,116,139,0.8); color: white; }
        .ctrl-btn.end   { background: rgba(16,185,129,0.9); color: white; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </>
  );
}