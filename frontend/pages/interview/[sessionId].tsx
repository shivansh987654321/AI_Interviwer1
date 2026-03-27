import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import Editor, { OnChange } from '@monaco-editor/react';
import VoiceAssistant from '../../components/VoiceAssistant';
import type { Socket } from 'socket.io-client';

interface Question {
  title: string;
  description: string;
  testCases?: { input: string; output: string }[];
  difficulty?: string;
}

const TEMPLATES: Record<string, string> = {
  javascript: `/**\n * Write your solution below\n */\nfunction solution(nums) {\n  // your code here\n  return 0;\n}`,
  python:     `def solution(nums):\n    # your code here\n    return 0`,
  java:       `class Solution {\n    public int solution(int[] nums) {\n        // your code here\n        return 0;\n    }\n}`,
  cpp:        `class Solution {\npublic:\n    int solution(vector<int>& nums) {\n        // your code here\n        return 0;\n    }\n};`,
};

const LANGUAGES = ['javascript', 'python', 'java', 'cpp'] as const;
const TIME_WARNING_THRESHOLD = 300;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4ade80', medium: '#facc15', hard: '#f87171',
};

// ---- TOAST ----
function Toast({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  const accent = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#60a5fa';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      background: 'rgba(15,15,20,0.92)',
      backdropFilter: 'blur(16px)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderLeft: `3px solid ${accent}`,
      color: '#fff', padding: '12px 16px', borderRadius: 12,
      zIndex: 9999, maxWidth: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>✕</button>
    </div>
  );
}

// ---- LANGUAGE CONFIRM MODAL ----
function LangConfirmModal({ targetLang, onConfirm, onCancel }: { targetLang: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'rgba(20,20,28,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 36px', textAlign: 'center', color: '#fff', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔄</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Switch to {targetLang.toUpperCase()}?</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 24, fontSize: '0.88rem', lineHeight: 1.5 }}>
          Your current code will be reset. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            Switch
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- PROFESSIONAL AVATAR ----
function AIAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="avatar-wrap">
      {/* Animated ring when speaking */}
      {isSpeaking && (
        <>
          <div className="avatar-ring ring1" />
          <div className="avatar-ring ring2" />
        </>
      )}

      {/* Photo placeholder — replace src with real photo if you have one */}
      <div className="avatar-photo">
        {/* Suit-wearing professional silhouette using CSS */}
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          {/* Head */}
          <circle cx="50" cy="32" r="16" fill="#d4a574" />
          {/* Hair */}
          <ellipse cx="50" cy="22" rx="16" ry="8" fill="#3d2b1f" />
          {/* Suit jacket */}
          <path d="M20 100 Q20 68 35 64 L50 70 L65 64 Q80 68 80 100Z" fill="#1e293b" />
          {/* White shirt */}
          <path d="M42 64 L50 70 L58 64 L56 100 L44 100Z" fill="#f1f5f9" />
          {/* Tie */}
          <path d="M48 66 L50 72 L52 66 L51 90 L50 92 L49 90Z" fill="#7c3aed" />
          {/* Lapels */}
          <path d="M35 64 L42 64 L44 100 L20 100 Q20 72 35 64Z" fill="#1e293b" />
          <path d="M65 64 L58 64 L56 100 L80 100 Q80 72 65 64Z" fill="#1e293b" />
          {/* Collar */}
          <path d="M44 64 L50 68 L42 64Z" fill="#f1f5f9" />
          <path d="M56 64 L50 68 L58 64Z" fill="#f1f5f9" />
          {/* Neck */}
          <rect x="44" y="47" width="12" height="18" rx="4" fill="#d4a574" />
          {/* Shoulders hint */}
          <ellipse cx="27" cy="68" rx="10" ry="6" fill="#1e293b" />
          <ellipse cx="73" cy="68" rx="10" ry="6" fill="#1e293b" />
        </svg>
      </div>

      {/* Speaking waveform */}
      {isSpeaking && (
        <div className="waveform">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}

      <div className="avatar-name">Alex Chen</div>
      <div className="avatar-role">Senior Engineer · FAANG</div>
      {isSpeaking && <div className="speaking-badge">● Speaking</div>}

      <style jsx>{`
        .avatar-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .avatar-photo {
          width: 110px; height: 110px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 2px solid rgba(168,85,247,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          z-index: 2;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .avatar-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(168,85,247,0.3);
          z-index: 1;
        }
        .ring1 { width: 130px; height: 130px; animation: ringPulse 1.5s ease-out infinite; }
        .ring2 { width: 155px; height: 155px; animation: ringPulse 1.5s ease-out infinite 0.5s; }
        @keyframes ringPulse {
          0%   { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .waveform {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }
        .wave-bar {
          width: 3px;
          background: #a855f7;
          border-radius: 999px;
          animation: wave 0.8s ease-in-out infinite alternate;
        }
        .wave-bar:nth-child(1) { height: 6px; }
        .wave-bar:nth-child(2) { height: 14px; }
        .wave-bar:nth-child(3) { height: 18px; }
        .wave-bar:nth-child(4) { height: 14px; }
        .wave-bar:nth-child(5) { height: 6px; }
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
        .avatar-name {
          font-weight: 700;
          font-size: 1rem;
          color: rgba(255,255,255,0.9);
        }
        .avatar-role {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.35);
        }
        .speaking-badge {
          font-size: 0.72rem;
          color: #a855f7;
          font-weight: 600;
          animation: blink 1s ease-in-out infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ---- MAIN PAGE ----
export default function InterviewPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { user } = useUser();

  const [question, setQuestion]           = useState<Question | null>(null);
  const [code, setCode]                   = useState(TEMPLATES.javascript);
  const [language, setLanguage]           = useState('javascript');
  const [timeLeft, setTimeLeft]           = useState(0);
  const [isCodingStarted, setIsCodingStarted] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [routerReady, setRouterReady]     = useState(false);
  const [aiSpeaking, setAiSpeaking]       = useState(false);
  const [toast, setToast]                 = useState<{ message: string; type: string } | null>(null);
  const [pendingLang, setPendingLang]     = useState<string | null>(null);
  const [timeExpired, setTimeExpired]     = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interviewCompleted, setInterviewCompleted] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => { if (router.isReady) setRouterReady(true); }, [router.isReady]);

  useEffect(() => {
    if (!sessionId || !routerReady) return;
    axios.get(`${apiUrl}/api/interview/${sessionId}`)
      .then((res) => {
        const s = res.data.session;
        setQuestion(s.question);
        setTimeLeft(s.duration || 1800);
        setLoading(false);
      })
      .catch(() => {
        showToast('Failed to load interview session.', 'error');
        setLoading(false);
      });
  }, [sessionId, routerReady]);

  useEffect(() => {
    if (!isCodingStarted || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === TIME_WARNING_THRESHOLD) showToast('⚠️ 5 minutes remaining!', 'info');
        if (prev <= 1) { clearInterval(t); setTimeExpired(true); showToast('⏰ Time is up!', 'error'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isCodingStarted]);

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  const showToast = (message: string, type: string) => setToast({ message, type });
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerColor = timeLeft <= TIME_WARNING_THRESHOLD ? '#f87171' : '#4ade80';

  const handleSocketReady  = useCallback((s: Socket) => { socketRef.current = s; }, []);
  const handleCodingStart  = useCallback(() => setIsCodingStarted(true), []);
  const handleSpeakingChange = useCallback((v: boolean) => setAiSpeaking(v), []);
  const handleEditorChange: OnChange = useCallback((v) => setCode(v || ''), []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const l = e.target.value;
    if (l !== language) setPendingLang(l);
  };

  const confirmLanguageSwitch = () => {
    if (!pendingLang) return;
    setLanguage(pendingLang);
    setCode(TEMPLATES[pendingLang]);
    setPendingLang(null);
  };

  const handleSubmit = async () => {
    if (!code.trim()) { showToast('Please write some code first.', 'error'); return; }
    if (interviewCompleted) { showToast('Interview already completed!', 'info'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${apiUrl}/api/interview/submit`, { sessionId, code, language });
      socketRef.current?.emit('submit_code_result', { sessionId, result: res.data });

      if (res.data.nextQuestion) {
        showToast('✅ Correct! Moving to next question.', 'success');
        setQuestion(res.data.nextQuestion);
        setCode(TEMPLATES[language]);
        setQuestionIndex(res.data.questionIndex ?? questionIndex + 1);
      } else if (res.data.completed) {
        setInterviewCompleted(true);
        showToast('🎉 All done! Click "Finish Interview" to get your report.', 'success');
      } else {
        showToast(res.data.message || 'Try again!', 'info');
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setInterviewCompleted(true);
        showToast('Interview already completed!', 'info');
      } else {
        showToast('Submission failed. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050508', color: 'rgba(255,255,255,0.4)', gap: 16, fontFamily: 'sans-serif' }}>
        <div style={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ margin: 0 }}>Initializing Interview...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!sessionId || typeof sessionId !== 'string') return null;

  return (
    <div className="root">
      {/* Subtle background */}
      <div className="bg-glow bg-glow1" />
      <div className="bg-glow bg-glow2" />

      {pendingLang && pendingLang !== language && (
        <LangConfirmModal targetLang={pendingLang} onConfirm={confirmLanguageSwitch} onCancel={() => setPendingLang(null)} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <VoiceAssistant
        sessionId={sessionId}
        onCodingStart={handleCodingStart}
        userId={user?.id}
        onSpeakingChange={handleSpeakingChange}
        onSocketReady={handleSocketReady}
      />

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-brand">⚡ AI Interviewer</span>
          {question?.difficulty && (
            <span className="diff-badge" style={{ color: DIFFICULTY_COLORS[question.difficulty] || '#fff', borderColor: DIFFICULTY_COLORS[question.difficulty] || '#fff', background: `${DIFFICULTY_COLORS[question.difficulty]}15` }}>
              {question.difficulty.toUpperCase()}
            </span>
          )}
          <span className="question-title">{question?.title || 'Technical Interview'}</span>
        </div>
        <div className="header-right">
          {isCodingStarted && (
            <>
              <div className="q-progress">
                Q {questionIndex + 1} / 3
              </div>
              <div className="timer" style={{ color: timerColor }}>
                ⏱ {formatTime(timeLeft)}
                {timeExpired && <span className="expired-pill">TIME UP</span>}
              </div>
            </>
          )}
          <select value={language} onChange={handleLanguageChange} className="lang-select" disabled={!isCodingStarted}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
          <button onClick={handleSubmit} disabled={submitting || !isCodingStarted} className="submit-btn">
            {submitting
              ? <span className="btn-inner"><span className="spinner" /> Evaluating...</span>
              : 'Submit Solution'}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <main className="workspace">
        {!isCodingStarted ? (
          /* ---- VERBAL ROUND ---- */
          <div className="verbal-screen">
            <div className="verbal-card">
              <AIAvatar isSpeaking={aiSpeaking} />
              <div className="verbal-info">
                <h2>Verbal Interview in Progress</h2>
                <p>Answer the interviewer&apos;s questions out loud. The coding environment unlocks after the theory round.</p>
                <div className="verbal-steps">
                  {['Introduction', 'Theory Questions', 'Coding Round'].map((step, i) => (
                    <div key={step} className="step">
                      <div className={`step-dot ${i === 1 ? 'active' : i === 0 ? 'done' : ''}`}>
                        {i === 0 ? '✓' : i + 1}
                      </div>
                      <span className={`step-label ${i === 1 ? 'step-active' : ''}`}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ---- CODING ROUND ---- */
          <div className="coding-area">
            {/* Problem panel */}
            <div className="problem-panel">
              <div className="problem-header">
                <h3>Problem Statement</h3>
                {question?.difficulty && (
                  <span className="problem-diff" style={{ color: DIFFICULTY_COLORS[question.difficulty] || '#fff' }}>
                    {question.difficulty}
                  </span>
                )}
              </div>
              <p className="problem-desc">{question?.description}</p>

              {question?.testCases && question.testCases.length > 0 && (
                <div className="example-box">
                  <div className="example-label">Example</div>
                  <div className="example-row">
                    <span className="example-key">Input:</span>
                    <code>{question.testCases[0].input}</code>
                  </div>
                  <div className="example-row">
                    <span className="example-key">Output:</span>
                    <code>{question.testCases[0].output}</code>
                  </div>
                </div>
              )}

              {timeExpired && (
                <div className="expired-notice">
                  ⏰ Time expired — you can still submit your current solution.
                </div>
              )}

              {/* Question progress */}
              <div className="q-dots">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`q-dot ${i < questionIndex ? 'q-done' : i === questionIndex ? 'q-current' : ''}`} />
                ))}
              </div>
            </div>

            {/* Editor panel */}
            <div className="editor-panel">
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={handleEditorChange}
                loading={<div style={{ color: 'rgba(255,255,255,0.3)', padding: 20, fontFamily: 'monospace' }}>Loading editor...</div>}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 20 },
                  readOnly: timeExpired,
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'gutter',
                }}
              />
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #050508;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
          position: relative;
        }
        .bg-glow {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
          pointer-events: none;
        }
        .bg-glow1 { width: 500px; height: 500px; background: #7c3aed; top: -200px; left: -150px; }
        .bg-glow2 { width: 400px; height: 400px; background: #2563eb; bottom: -150px; right: -100px; }

        /* Header */
        .header {
          height: 56px;
          min-height: 56px;
          background: rgba(10,10,16,0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
          z-index: 10;
          position: relative;
          gap: 12px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          min-width: 0;
        }
        .header-brand {
          font-weight: 700;
          font-size: 0.95rem;
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .diff-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        .question-title {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.75);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .q-progress {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.35);
          white-space: nowrap;
          padding: 4px 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
        }
        .timer {
          font-family: 'SF Mono', monospace;
          font-size: 1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: color 0.5s;
        }
        .expired-pill {
          font-size: 0.6rem;
          background: #f87171;
          color: #000;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .lang-select {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          backdrop-filter: blur(8px);
          outline: none;
        }
        .lang-select:disabled { opacity: 0.35; cursor: not-allowed; }
        .submit-btn {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          border: none;
          padding: 7px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .btn-inner { display: flex; align-items: center; gap: 8px; }
        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        /* Workspace */
        .workspace { flex: 1; overflow: hidden; min-height: 0; position: relative; }

        /* Verbal screen */
        .verbal-screen {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(5,5,8,0.5);
        }
        .verbal-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          padding: 48px 56px;
          display: flex;
          align-items: center;
          gap: 48px;
          max-width: 780px;
          width: 90%;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset;
        }
        .verbal-info h2 {
          font-size: 1.4rem;
          font-weight: 700;
          margin: 0 0 10px;
          color: rgba(255,255,255,0.9);
        }
        .verbal-info p {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.4);
          line-height: 1.6;
          margin: 0 0 24px;
          max-width: 340px;
        }
        .verbal-steps { display: flex; flex-direction: column; gap: 12px; }
        .step { display: flex; align-items: center; gap: 10px; }
        .step-dot {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.3);
          flex-shrink: 0;
          font-weight: 700;
        }
        .step-dot.active { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.5); color: #c084fc; }
        .step-dot.done  { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.4); color: #4ade80; }
        .step-label { font-size: 0.88rem; color: rgba(255,255,255,0.4); }
        .step-active { color: rgba(255,255,255,0.85) !important; font-weight: 600; }

        /* Coding area */
        .coding-area { display: flex; height: 100%; }
        .problem-panel {
          width: 38%;
          min-width: 280px;
          max-width: 440px;
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(12px);
          border-right: 1px solid rgba(255,255,255,0.07);
          padding: 24px;
          overflow-y: auto;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .problem-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 12px;
        }
        .problem-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.85); }
        .problem-diff { font-size: 0.78rem; font-weight: 600; text-transform: capitalize; }
        .problem-desc { font-size: 0.9rem; color: rgba(255,255,255,0.6); line-height: 1.75; margin: 0; }
        .example-box {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .example-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 4px;
        }
        .example-row { display: flex; align-items: baseline; gap: 8px; }
        .example-key { font-size: 0.8rem; color: rgba(255,255,255,0.3); min-width: 50px; }
        .example-row code {
          font-family: 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .expired-notice {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .q-dots {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 8px;
        }
        .q-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          transition: all 0.3s;
        }
        .q-done    { background: rgba(74,222,128,0.4);  border-color: #4ade80; }
        .q-current { background: rgba(168,85,247,0.5); border-color: #a855f7; }

        /* Editor */
        .editor-panel { flex: 1; overflow: hidden; min-width: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .verbal-card { flex-direction: column; padding: 32px 24px; gap: 32px; }
          .verbal-info p { max-width: 100%; }
          .problem-panel { width: 100%; max-width: 100%; height: 40%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); }
          .coding-area { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}