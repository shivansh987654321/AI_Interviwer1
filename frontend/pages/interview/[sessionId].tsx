// pages/interview/[sessionId].tsx
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import Editor, { OnChange } from '@monaco-editor/react';
import VoiceAssistant from '../../components/VoiceAssistant';
import CameraFeed from '../../components/CameraFeed';
import AIAvatar from '../../components/AIAvatar';
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

const DIFF_COLORS: Record<string, string> = {
  easy: '#4ade80', medium: '#facc15', hard: '#f87171',
};

const DIFFICULTY_LEVELS: Record<string, { label: string; color: string; progress: number }> = {
  warmup: { label: 'Introduction', color: '#4ade80',  progress: 10 },
  easy:   { label: 'Easy',         color: '#60a5fa',  progress: 35 },
  medium: { label: 'Medium',       color: '#facc15',  progress: 65 },
  hard:   { label: 'Hard',         color: '#f87171',  progress: 90 },
};

// ---- TOAST ----
function Toast({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  const accent = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#60a5fa';
  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 24,
      background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(16px)',
      border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${accent}`,
      color: '#fff', padding: '10px 14px', borderRadius: 10,
      zIndex: 9999, maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
    </div>
  );
}

// ---- LANGUAGE CONFIRM ----
function LangConfirmModal({ targetLang, onConfirm, onCancel }: { targetLang: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'rgba(15,15,20,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 32px', textAlign: 'center', color: '#fff', maxWidth: 340 }}>
        <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>🔄</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Switch to {targetLang.toUpperCase()}?</h3>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 20, fontSize: '0.85rem' }}>Current code will be reset.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Switch</button>
        </div>
      </div>
    </div>
  );
}

// ---- MAIN PAGE ----
export default function InterviewPage() {
  const router     = useRouter();
  const { sessionId } = router.query;
  const { user }   = useUser();

  const [question, setQuestion]     = useState<Question | null>(null);
  const [code, setCode]             = useState(TEMPLATES.javascript);
  const [language, setLanguage]     = useState('javascript');
  const [timeLeft, setTimeLeft]     = useState(0);
  const [isCodingStarted, setIsCodingStarted] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [routerReady, setRouterReady] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [toast, setToast]           = useState<{ message: string; type: string } | null>(null);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState('warmup');
  const [resumeContext] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('resumeContext') || undefined;
    }
  });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => { if (router.isReady) setRouterReady(true); }, [router.isReady]);

  useEffect(() => {
    if (!sessionId || !routerReady) return;
    axios.get(`${apiUrl}/api/interview/${sessionId}`)
      .then(res => {
        const s = res.data.session;
        setQuestion(s.question);
        setTimeLeft(s.duration || 1800);
        setLoading(false);
      })
      .catch(() => {
        showToast('Failed to load session.', 'error');
        setLoading(false);
      });
  }, [sessionId, routerReady]);

  useEffect(() => {
    if (!isCodingStarted || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
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

  const handleSocketReady    = useCallback((s: Socket) => { socketRef.current = s; }, []);
  const handleCodingStart    = useCallback(() => setIsCodingStarted(true), []);
  const handleSpeakingChange = useCallback((v: boolean) => setAiSpeaking(v), []);
  const handleEditorChange: OnChange = useCallback((v) => setCode(v || ''), []);
  const handleDifficultyChange = useCallback((level: string) => setDifficultyLevel(level), []);

  const handleCheatEvent = useCallback((type: string, detail?: string) => {
    socketRef.current?.emit('cheat_event', { sessionId, type, detail });
  }, [sessionId]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const l = e.target.value;
    if (l !== language) setPendingLang(l);
  };

  const confirmLanguageSwitch = () => {
    if (!pendingLang) return;
    setLanguage(pendingLang); setCode(TEMPLATES[pendingLang]); setPendingLang(null);
  };

  const handleSubmit = async () => {
    if (!code.trim()) { showToast('Write some code first.', 'error'); return; }
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
        showToast('🎉 All done! Click "Finish" to get your report.', 'success');
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050508', color: 'rgba(255,255,255,0.4)', gap: 12, fontFamily: 'sans-serif' }}>
      <div style={{ width: 30, height: 30, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ margin: 0 }}>Initializing Interview...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!sessionId || typeof sessionId !== 'string') return null;

  const diffInfo = DIFFICULTY_LEVELS[difficultyLevel] || DIFFICULTY_LEVELS.warmup;

  return (
    <div className="root">
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
        onDifficultyChange={handleDifficultyChange}
        onCheatEvent={handleCheatEvent}
        resumeContext={resumeContext}
      />

      {/* ====== HEADER ====== */}
      <header className="header">
        <div className="header-left">
          <span className="brand">⚡ AI Interviewer</span>
          <div className="divider" />
          {!isCodingStarted ? (
            <span className="phase-label">Verbal Round</span>
          ) : (
            <>
              {question?.difficulty && (
                <span className="diff-badge" style={{ color: DIFF_COLORS[question.difficulty] || '#fff', background: `${DIFF_COLORS[question.difficulty] || '#fff'}15`, borderColor: `${DIFF_COLORS[question.difficulty] || '#fff'}40` }}>
                  {question.difficulty.toUpperCase()}
                </span>
              )}
              <span className="q-title">{question?.title || 'Coding Challenge'}</span>
            </>
          )}
        </div>
        <div className="header-right">
          {isCodingStarted && (
            <>
              <div className="q-counter">Q {questionIndex + 1} / 3</div>
              <div className="coding-timer" style={{ color: timerColor }}>
                ⏱ {formatTime(timeLeft)}
                {timeExpired && <span className="expired-tag">TIME UP</span>}
              </div>
              <select value={language} onChange={handleLanguageChange} className="lang-sel" disabled={!isCodingStarted}>
                {LANGUAGES.map(l => (
                  <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
              <button onClick={handleSubmit} disabled={submitting || !isCodingStarted || !!pendingLang} className="submit-btn">
                {submitting
                  ? <><span className="spin-sm" /> Evaluating...</>
                  : 'Submit Solution'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ====== WORKSPACE ====== */}
      <main className="workspace">
        {!isCodingStarted ? (
          /* ---- VERBAL ROUND LAYOUT ---- */
          <div className="verbal-layout">

            {/* LEFT: Interviewer panel */}
            <div className="interviewer-panel">
              {/* Difficulty progress — hidden for realistic interview */}

              {/* Avatar */}
              <div className="avatar-section">
                <AIAvatar
                  isSpeaking={aiSpeaking}
                  difficulty_level={difficultyLevel as any}
                />
              </div>

              {/* Status message */}
              <div className="interviewer-status">
                {aiSpeaking
                  ? <span style={{ color: '#a855f7' }}>Alex is speaking...</span>
                  : <span style={{ color: 'rgba(255,255,255,0.35)' }}>Waiting for your response</span>}
              </div>
            </div>

            {/* RIGHT: Candidate panel */}
            <div className="candidate-panel">
              {/* Camera */}
              <div className="camera-section">
                <CameraFeed
                  sessionId={sessionId}
                  onCheatEvent={handleCheatEvent}
                />
              </div>

              {/* Interview steps — hidden for realistic feel */}

              {/* Tip hidden */}
            </div>
          </div>
        ) : (
          /* ---- CODING ROUND ---- */
          <div className="coding-layout">
            {/* Problem panel */}
            <div className="problem-panel">
              <div className="problem-head">
                <span className="problem-title">{question?.title || 'Problem'}</span>
                {question?.difficulty && (
                  <span style={{ color: DIFF_COLORS[question.difficulty] || '#fff', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                    {question.difficulty}
                  </span>
                )}
              </div>
              <p className="problem-desc">{question?.description}</p>

              {question?.testCases && question.testCases.length > 0 && (
                <div className="example-box">
                  <div className="example-head">Example</div>
                  {question.testCases.slice(0, 2).map((tc, i) => (
                    <div key={i} className="example-case">
                      <div className="case-row"><span className="case-key">Input:</span> <code>{tc.input}</code></div>
                      <div className="case-row"><span className="case-key">Output:</span> <code>{tc.output}</code></div>
                      {i < question.testCases!.length - 1 && <hr className="case-divider" />}
                    </div>
                  ))}
                </div>
              )}

              {timeExpired && (
                <div className="expired-banner">⏰ Time expired — you may still submit.</div>
              )}

              {/* Question dots */}
              <div className="q-dots">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`q-dot ${i < questionIndex ? 'q-done' : i === questionIndex ? 'q-cur' : ''}`} />
                ))}
                <span className="q-dot-label">Question {questionIndex + 1} of 3</span>
              </div>

              {/* Small camera in coding mode */}
              <div className="coding-camera">
                <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
              </div>
            </div>

            {/* Editor */}
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
                  fontFamily: "'Fira Code','Cascadia Code',monospace",
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
          display: flex; flex-direction: column;
          height: 100vh; background: #050508; color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden; position: relative;
        }

        /* Header */
        .header {
          height: 52px; min-height: 52px;
          background: rgba(8,8,14,0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 0 16px; flex-shrink: 0; z-index: 10; gap: 10px;
        }
        .header-left { display: flex; align-items: center; gap: 10px; overflow: hidden; }
        .brand { font-weight: 700; font-size: 0.9rem; color: rgba(255,255,255,0.6); white-space: nowrap; flex-shrink: 0; }
        .divider { width: 1px; height: 18px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
        .phase-label {
          font-size: 0.82rem; color: #a855f7; font-weight: 600;
          background: rgba(168,85,247,0.1); padding: 2px 10px;
          border-radius: 6px; border: 1px solid rgba(168,85,247,0.25);
        }
        .diff-badge {
          font-size: 0.62rem; font-weight: 700; padding: 2px 8px;
          border-radius: 999px; border: 1px solid; flex-shrink: 0;
          letter-spacing: 0.5px;
        }
        .q-title {
          font-size: 0.88rem; color: rgba(255,255,255,0.7);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .q-counter {
          font-size: 0.78rem; color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.04); padding: 3px 10px; border-radius: 8px;
        }
        .coding-timer {
          font-family: 'SF Mono', monospace; font-size: 0.95rem; font-weight: 700;
          display: flex; align-items: center; gap: 5px; white-space: nowrap;
        }
        .expired-tag {
          font-size: 0.58rem; background: #f87171; color: #000;
          padding: 1px 5px; border-radius: 3px; font-weight: 800; letter-spacing: 0.5px;
        }
        .lang-sel {
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1); padding: 4px 8px;
          border-radius: 7px; font-size: 0.82rem; cursor: pointer; outline: none;
        }
        .lang-sel:disabled { opacity: 0.3; cursor: not-allowed; }
        .submit-btn {
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          color: #fff; border: none; padding: 6px 14px;
          border-radius: 8px; cursor: pointer; font-weight: 700;
          font-size: 0.82rem; display: flex; align-items: center; gap: 5px;
          white-space: nowrap; transition: all 0.2s;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
        .spin-sm {
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
        }

        /* Workspace */
        .workspace { flex: 1; overflow: hidden; min-height: 0; }

        /* ====== VERBAL LAYOUT ====== */
        .verbal-layout {
          height: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        /* LEFT — Interviewer */
        .interviewer-panel {
          background: rgba(8,8,14,0.6);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 32px 40px; gap: 24px; position: relative;
        }

        /* Difficulty progress */
        .diff-progress-wrap {
          width: 100%; max-width: 320px;
        }
        .diff-progress-bar {
          width: 100%; height: 4px;
          background: rgba(255,255,255,0.07);
          border-radius: 2px; overflow: hidden; margin-bottom: 8px;
        }
        .diff-progress-fill {
          height: 100%; border-radius: 2px;
          transition: width 0.8s ease, background 0.5s ease;
        }
        .diff-progress-labels {
          display: flex; justify-content: space-between;
        }

        /* Avatar */
        .avatar-section { display: flex; align-items: center; justify-content: center; }
        .interviewer-status {
          font-size: 0.82rem; min-height: 20px;
          text-align: center;
        }

        /* RIGHT — Candidate */
        .candidate-panel {
          display: flex; flex-direction: column;
          padding: 24px; gap: 16px; overflow-y: auto;
          background: rgba(5,5,8,0.4);
        }
        .camera-section { flex-shrink: 0; }
        .interview-steps { display: flex; flex-direction: column; gap: 8px; }
        .steps-title {
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px;
          color: rgba(255,255,255,0.25); margin: 0 0 8px; font-weight: 500;
        }
        .step-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
          transition: all 0.3s; position: relative;
        }
        .step-item.active {
          border-color: rgba(168,85,247,0.35);
          background: rgba(168,85,247,0.06);
        }
        .step-item.done {
          border-color: rgba(74,222,128,0.2);
          background: rgba(74,222,128,0.04);
          opacity: 0.7;
        }
        .step-item.locked { opacity: 0.35; }
        .step-dot {
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; color: rgba(255,255,255,0.3);
          flex-shrink: 0; font-weight: 700;
        }
        .step-item.active  .step-dot { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.5); color: #c084fc; }
        .step-item.done    .step-dot { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.4); color: #4ade80; }
        .step-body { flex: 1; min-width: 0; }
        .step-label {
          font-size: 0.85rem; color: rgba(255,255,255,0.7); font-weight: 500;
        }
        .step-item.active .step-label { color: rgba(255,255,255,0.9); }
        .step-desc { font-size: 0.72rem; color: rgba(255,255,255,0.25); margin-top: 1px; }
        .step-active-pill {
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.5px;
          background: rgba(168,85,247,0.25); color: #d8b4fe;
          padding: 2px 7px; border-radius: 4px;
          border: 1px solid rgba(168,85,247,0.3);
          flex-shrink: 0;
        }
        .tip-box {
          background: rgba(96,165,250,0.06); border: 1px solid rgba(96,165,250,0.15);
          border-radius: 10px; padding: 10px 12px;
          font-size: 0.78rem; color: rgba(255,255,255,0.45);
          display: flex; gap: 8px; align-items: flex-start;
          flex-shrink: 0;
        }
        .tip-icon { flex-shrink: 0; font-size: 0.85rem; }

        /* ====== CODING LAYOUT ====== */
        .coding-layout { display: flex; height: 100%; }
        .problem-panel {
          width: 38%; min-width: 260px; max-width: 420px;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 20px; overflow-y: auto; flex-shrink: 0;
          display: flex; flex-direction: column; gap: 14px;
        }
        .problem-head {
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;
        }
        .problem-title { font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.85); }
        .problem-desc { font-size: 0.88rem; color: rgba(255,255,255,0.55); line-height: 1.75; margin: 0; }
        .example-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px 14px;
        }
        .example-head {
          font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.8px;
          color: rgba(255,255,255,0.25); margin-bottom: 8px; font-weight: 700;
        }
        .example-case { display: flex; flex-direction: column; gap: 4px; }
        .case-row { display: flex; align-items: baseline; gap: 8px; }
        .case-key { font-size: 0.78rem; color: rgba(255,255,255,0.25); min-width: 52px; }
        .case-row code {
          font-family: 'Fira Code', monospace; font-size: 0.8rem;
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px;
        }
        .case-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 8px 0; }
        .expired-banner {
          background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5; padding: 8px 12px; border-radius: 8px; font-size: 0.82rem;
        }
        .q-dots { display: flex; align-items: center; gap: 8px; }
        .q-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          transition: all 0.3s;
        }
        .q-done { background: rgba(74,222,128,0.4); border-color: #4ade80; }
        .q-cur  { background: rgba(168,85,247,0.5); border-color: #a855f7; }
        .q-dot-label { font-size: 0.72rem; color: rgba(255,255,255,0.25); margin-left: 2px; }
        .coding-camera { margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); }
        .editor-panel { flex: 1; overflow: hidden; min-width: 0; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .verbal-layout { grid-template-columns: 1fr; }
          .interviewer-panel { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 24px; }
          .coding-layout { flex-direction: column; }
          .problem-panel { width: 100%; max-width: 100%; height: 40%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
        }
      `}</style>
    </div>
  );
}