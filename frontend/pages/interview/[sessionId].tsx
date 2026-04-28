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

interface TestCase {
  input: string;
  output: string;
  stdin?: string;
  expectedOutput?: string;
}

interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status?: string;
  time?: string | null;
  memory?: number | null;
}

interface StarterCode {
  javascript: string;
  python: string;
  java: string;
  cpp: string;
}

interface Question {
  title: string;
  description: string;
  testCases?: TestCase[];
  difficulty?: string;
  constraints?: string[];
  starterCode?: StarterCode;
}

const FALLBACK_TEMPLATES: Record<string, string> = {
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');\n\n// ─── YOUR SOLUTION ───────────────────────────────────────────────\nfunction solution(lines) {\n  // write your solution here\n  \n}\n// ─────────────────────────────────────────────────────────────────\n\nconsole.log(solution(lines));`,
  python:     `import sys\nlines = sys.stdin.read().strip().split('\\n')\n\n# ─── YOUR SOLUTION ───────────────────────────────────────────────\ndef solution(lines):\n    # write your solution here\n    pass\n# ─────────────────────────────────────────────────────────────────\n\nprint(solution(lines))`,
  java:       `import java.util.*;\nclass Main {\n    // ─── YOUR SOLUTION ───────────────────────────────────────────────\n    // add your methods here\n    // ─────────────────────────────────────────────────────────────────\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // parse and solve\n    }\n}`,
  cpp:        `#include<bits/stdc++.h>\nusing namespace std;\n// ─── YOUR SOLUTION ───────────────────────────────────────────────\n// add your solution here\n// ─────────────────────────────────────────────────────────────────\nint main(){\n    // parse input and output result\n    return 0;\n}`,
};

const LANGUAGES = ['javascript', 'python', 'java', 'cpp'] as const;
const TIME_WARNING_THRESHOLD = 300;
const TOTAL_QUESTIONS = 2;
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

// Verdict color
const VERDICT_COLOR: Record<string, string> = {
  'Accepted':            '#4ade80',
  'Wrong Answer':        '#f87171',
  'Compilation Error':   '#fb923c',
  'Time Limit Exceeded': '#facc15',
  'Runtime Error':       '#c084fc',
};

// ---- TOAST ----
function Toast({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
  const accent = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#60a5fa';
  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 24,
      background: 'rgba(10,10,16,0.97)', backdropFilter: 'blur(16px)',
      border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${accent}`,
      color: '#fff', padding: '10px 14px', borderRadius: 10,
      zIndex: 9999, maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
        <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 20, fontSize: '0.85rem' }}>Current code will be reset to the new language template.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Switch</button>
        </div>
      </div>
    </div>
  );
}

// ---- TEST CASE RESULT ROW ----
function TestResultRow({ result, index }: { result: TestCaseResult; index: number }) {
  const [open, setOpen] = useState(true);
  const statusColor = result.passed ? '#4ade80' : result.status === 'Compilation Error' ? '#fb923c' : result.status === 'Time Limit Exceeded' ? '#facc15' : '#f87171';

  return (
    <div style={{
      border: `1px solid ${result.passed ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
      borderRadius: 10, overflow: 'hidden', background: result.passed ? 'rgba(74,222,128,0.03)' : 'rgba(248,113,113,0.03)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: '#fff', fontSize: '0.82rem',
        }}
      >
        <span style={{ color: statusColor, fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>
          {result.passed ? '✓' : '✗'}
        </span>
        <span style={{ fontWeight: 600 }}>Case {index + 1}</span>
        {result.status && !result.passed && (
          <span style={{ color: statusColor, fontSize: '0.72rem', fontWeight: 600, marginLeft: 4 }}>
            {result.status}
          </span>
        )}
        {result.time && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', marginLeft: 'auto' }}>
            {result.time}s
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: result.time ? 0 : 'auto', fontSize: '0.7rem' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ResultField label="Input" value={result.input} />
          <ResultField label="Expected" value={result.expectedOutput} color="#4ade80" />
          <ResultField label="Got" value={result.actualOutput} color={result.passed ? '#4ade80' : '#f87171'} />
        </div>
      )}
    </div>
  );
}

function ResultField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      <pre style={{
        margin: 0, padding: '4px 8px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 6,
        fontFamily: "'Fira Code',monospace", fontSize: '0.78rem',
        color: color || 'rgba(255,255,255,0.7)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflow: 'auto',
      }}>
        {value || '(empty)'}
      </pre>
    </div>
  );
}

// ---- RESULTS PANEL ----
function ResultsPanel({
  runResults, submitResults, verdict, score, feedback, isRunning, isSubmitting,
}: {
  runResults:     TestCaseResult[] | null;
  submitResults:  TestCaseResult[] | null;
  verdict?:       string;
  score?:         number;
  feedback?:      string;
  isRunning:      boolean;
  isSubmitting:   boolean;
}) {
  const [tab, setTab] = useState<'run' | 'submit'>('run');

  useEffect(() => { if (submitResults) setTab('submit'); }, [submitResults]);
  useEffect(() => { if (runResults)    setTab('run'); },    [runResults]);

  const activeResults = tab === 'run' ? runResults : submitResults;
  const isLoading     = tab === 'run' ? isRunning  : isSubmitting;

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(5,5,8,0.9)', display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {(['run', 'submit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '7px 14px', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
            borderBottom: tab === t ? '2px solid #a855f7' : '2px solid transparent',
          }}>
            {t === 'run' ? '▶ Run Results' : '📤 Submit Results'}
            {t === 'submit' && verdict && (
              <span style={{ marginLeft: 6, color: VERDICT_COLOR[verdict] || '#fff', fontSize: '0.7rem' }}>
                {verdict}
              </span>
            )}
          </button>
        ))}
        {typeof score === 'number' && tab === 'submit' && (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: score >= 60 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
            {score}/100
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', padding: '10px 0' }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            {tab === 'run' ? 'Running test cases…' : 'Submitting and evaluating…'}
          </div>
        ) : !activeResults || activeResults.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem', padding: '10px 0', textAlign: 'center' }}>
            {tab === 'run' ? 'Click "Run Code" to test against sample cases' : 'Click "Submit" to evaluate against all test cases'}
          </div>
        ) : (
          <>
            {activeResults.map((r, i) => <TestResultRow key={i} result={r} index={i} />)}
            {tab === 'submit' && feedback && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '10px 12px', marginTop: 4,
              }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Feedback</div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{feedback}</p>
              </div>
            )}
          </>
        )}
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
  const [starterCodeMap, setStarterCodeMap] = useState<Partial<StarterCode> | null>(null);
  const [code, setCode]             = useState(FALLBACK_TEMPLATES.javascript);
  const [language, setLanguage]     = useState('javascript');
  const [timeLeft, setTimeLeft]     = useState(0);
  const [isCodingStarted, setIsCodingStarted] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning]       = useState(false);
  const [routerReady, setRouterReady] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [toast, setToast]           = useState<{ message: string; type: string } | null>(null);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState('warmup');
  const [resumeContext] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('resumeContext') || undefined;
  });

  // Results state
  const [runResults,    setRunResults]    = useState<TestCaseResult[] | null>(null);
  const [submitResults, setSubmitResults] = useState<TestCaseResult[] | null>(null);
  const [submitVerdict, setSubmitVerdict] = useState<string | undefined>();
  const [submitScore,   setSubmitScore]   = useState<number | undefined>();
  const [submitFeedback, setSubmitFeedback] = useState<string | undefined>();
  const [showResults, setShowResults]     = useState(false);

  const socketRef     = useRef<Socket | null>(null);
  const languageRef   = useRef(language);
  languageRef.current = language; // always in sync, no re-renders

  useEffect(() => { if (router.isReady) setRouterReady(true); }, [router.isReady]);

  const loadQuestion = useCallback((q: Question) => {
    setQuestion(q);
    setStarterCodeMap(q.starterCode ?? null);
    setRunResults(null);
    setSubmitResults(null);
    setSubmitVerdict(undefined);
    setSubmitScore(undefined);
    setSubmitFeedback(undefined);
  }, []);

  useEffect(() => {
    if (!sessionId || !routerReady) return;
    axios.get(`${apiUrl}/api/interview/${sessionId}`)
      .then(res => {
        const s = res.data.session;
        loadQuestion(s.question);
        setTimeLeft(s.duration || 3600);
        setLoading(false);
      })
      .catch(() => {
        showToast('Failed to load session.', 'error');
        setLoading(false);
      });
  }, [sessionId, routerReady, loadQuestion]);

  // When question changes (starterCodeMap updates), reset the editor to the question's starter code
  // for the currently selected language. Language switches are handled by confirmLanguageSwitch.
  useEffect(() => {
    if (starterCodeMap) {
      setCode((starterCodeMap as any)[languageRef.current] || FALLBACK_TEMPLATES[languageRef.current]);
    }
  }, [starterCodeMap]);

  useEffect(() => {
    if (!isCodingStarted) return;
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
    const template = starterCodeMap ? ((starterCodeMap as any)[pendingLang] || FALLBACK_TEMPLATES[pendingLang]) : FALLBACK_TEMPLATES[pendingLang];
    setLanguage(pendingLang);
    setCode(template);
    setPendingLang(null);
  };

  const handleRun = async () => {
    if (!code.trim()) { showToast('Write some code first.', 'error'); return; }
    setRunning(true);
    setShowResults(true);
    setRunResults(null);
    try {
      const res = await axios.post(`${apiUrl}/api/interview/run`, { sessionId, code, language });
      setRunResults(res.data.results ?? []);
      if ((res.data.results ?? []).length === 0) {
        showToast(res.data.message || 'No executable test cases available.', 'info');
      }
    } catch {
      showToast('Run failed. Check your code and try again.', 'error');
      setRunResults([]);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) { showToast('Write some code first.', 'error'); return; }
    if (interviewCompleted) { showToast('Interview already completed!', 'info'); return; }
    setSubmitting(true);
    setShowResults(true);
    setSubmitResults(null);
    try {
      const res = await axios.post(`${apiUrl}/api/interview/submit`, { sessionId, code, language });
      socketRef.current?.emit('submit_code_result', { sessionId, result: res.data });

      setSubmitVerdict(res.data.verdict);
      setSubmitScore(res.data.score);
      setSubmitFeedback(res.data.feedback);
      setSubmitResults(res.data.testCases ?? []);

      if (res.data.nextQuestion) {
        showToast(res.data.message || '✅ Moving to next question.', 'success');
        loadQuestion(res.data.nextQuestion);
        setCode(
          res.data.nextQuestion.starterCode?.[language] ||
          FALLBACK_TEMPLATES[language]
        );
        setQuestionIndex(res.data.questionIndex ?? questionIndex + 1);
      } else if (res.data.completed) {
        setInterviewCompleted(true);
        showToast('🎉 All done! Click "Finish" to get your report.', 'success');
      } else {
        showToast(res.data.message || 'Not all test cases passed. Try again!', 'info');
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
      <p style={{ margin: 0 }}>Initializing Interview…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!sessionId || typeof sessionId !== 'string') return null;

  const diffInfo = DIFFICULTY_LEVELS[difficultyLevel] || DIFFICULTY_LEVELS.warmup;
  const visibleTestCases = (question?.testCases ?? []).slice(0, 2);

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
              <div className="q-counter">Q {questionIndex + 1} / {TOTAL_QUESTIONS}</div>
              <div className="coding-timer" style={{ color: timerColor }}>
                ⏱ {formatTime(timeLeft)}
                {timeExpired && <span className="expired-tag">TIME UP</span>}
              </div>
              <select value={language} onChange={handleLanguageChange} className="lang-sel">
                {LANGUAGES.map(l => (
                  <option key={l} value={l}>{l === 'cpp' ? 'C++' : l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={handleRun}
                disabled={running || submitting || !!pendingLang}
                className="run-btn"
              >
                {running ? <><span className="spin-sm" /> Running…</> : '▶ Run'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || running || !!pendingLang}
                className="submit-btn"
              >
                {submitting ? <><span className="spin-sm" /> Submitting…</> : '📤 Submit'}
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
            <div className="interviewer-panel">
              <div className="avatar-section">
                <AIAvatar isSpeaking={aiSpeaking} difficulty_level={difficultyLevel as any} />
              </div>
              <div className="interviewer-status">
                {aiSpeaking
                  ? <span style={{ color: '#a855f7' }}>Alex is speaking…</span>
                  : <span style={{ color: 'rgba(255,255,255,0.35)' }}>Waiting for your response</span>}
              </div>
            </div>

            <div className="candidate-panel">
              <div className="camera-section">
                <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
              </div>
            </div>
          </div>
        ) : (
          /* ---- CODING ROUND ---- */
          <div className="coding-layout">

            {/* ── Problem Panel ── */}
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

              {question?.constraints && question.constraints.length > 0 && (
                <div className="constraints-box">
                  <div className="section-label">Constraints</div>
                  {question.constraints.map((c, i) => (
                    <div key={i} className="constraint-item">• {c}</div>
                  ))}
                </div>
              )}

              {/* Visible Test Cases */}
              {visibleTestCases.length > 0 && (
                <div className="testcases-section">
                  <div className="section-label">Examples</div>
                  {visibleTestCases.map((tc, i) => (
                    <div key={i} className="example-box">
                      <div className="example-num">Example {i + 1}</div>
                      <div className="case-row">
                        <span className="case-key">Input</span>
                        <code className="case-val">{tc.input}</code>
                      </div>
                      <div className="case-row">
                        <span className="case-key">Output</span>
                        <code className="case-val">{tc.output}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {timeExpired && (
                <div className="expired-banner">⏰ Time expired — you may still submit.</div>
              )}

              {/* Question progress dots */}
              <div className="q-dots">
                {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
                  <div key={i} className={`q-dot ${i < questionIndex ? 'q-done' : i === questionIndex ? 'q-cur' : ''}`} />
                ))}
                <span className="q-dot-label">Question {questionIndex + 1} of {TOTAL_QUESTIONS}</span>
              </div>

              {/* Small camera */}
              <div className="coding-camera">
                <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
              </div>
            </div>

            {/* ── Editor + Results Column ── */}
            <div className="editor-column">
              {/* Monaco Editor */}
              <div className="editor-area">
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={code}
                  onChange={handleEditorChange}
                  loading={<div style={{ color: 'rgba(255,255,255,0.3)', padding: 20, fontFamily: 'monospace' }}>Loading editor…</div>}
                  options={{
                    fontSize: 13.5,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                    readOnly: timeExpired,
                    fontFamily: "'Fira Code','Cascadia Code',monospace",
                    fontLigatures: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'gutter',
                    tabSize: 2,
                    wordWrap: 'on',
                  }}
                />
              </div>

              {/* Results Panel */}
              <div className={`results-area ${showResults ? 'results-open' : ''}`}>
                {!showResults ? (
                  <button
                    className="results-toggle"
                    onClick={() => setShowResults(true)}
                  >
                    <span>▶ Test Results</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem' }}>Click to expand</span>
                  </button>
                ) : (
                  <>
                    <button
                      className="results-toggle-close"
                      onClick={() => setShowResults(false)}
                      title="Collapse"
                    >▼ Hide Results</button>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <ResultsPanel
                        runResults={runResults}
                        submitResults={submitResults}
                        verdict={submitVerdict}
                        score={submitScore}
                        feedback={submitFeedback}
                        isRunning={running}
                        isSubmitting={submitting}
                      />
                    </div>
                  </>
                )}
              </div>
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

        /* ─── Header ─── */
        .header {
          height: 48px; min-height: 48px;
          background: rgba(8,8,14,0.95); backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 14px; flex-shrink: 0; z-index: 10; gap: 8px;
        }
        .header-left { display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1; min-width: 0; }
        .brand { font-weight: 700; font-size: 0.88rem; color: rgba(255,255,255,0.55); white-space: nowrap; flex-shrink: 0; }
        .divider { width: 1px; height: 18px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
        .phase-label {
          font-size: 0.8rem; color: #a855f7; font-weight: 600;
          background: rgba(168,85,247,0.1); padding: 2px 10px;
          border-radius: 6px; border: 1px solid rgba(168,85,247,0.25);
        }
        .diff-badge {
          font-size: 0.62rem; font-weight: 700; padding: 2px 8px;
          border-radius: 999px; border: 1px solid; flex-shrink: 0; letter-spacing: 0.5px;
        }
        .q-title {
          font-size: 0.85rem; color: rgba(255,255,255,0.65);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .q-counter {
          font-size: 0.75rem; color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.04); padding: 3px 9px; border-radius: 7px;
        }
        .coding-timer {
          font-family: 'SF Mono', monospace; font-size: 0.92rem; font-weight: 700;
          display: flex; align-items: center; gap: 4px; white-space: nowrap;
        }
        .expired-tag {
          font-size: 0.55rem; background: #f87171; color: #000;
          padding: 1px 5px; border-radius: 3px; font-weight: 800; letter-spacing: 0.5px;
        }
        .lang-sel {
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1); padding: 4px 7px;
          border-radius: 7px; font-size: 0.8rem; cursor: pointer; outline: none;
        }
        .run-btn {
          background: rgba(74,222,128,0.12); color: #4ade80;
          border: 1px solid rgba(74,222,128,0.3); padding: 5px 12px;
          border-radius: 8px; cursor: pointer; font-weight: 700;
          font-size: 0.8rem; display: flex; align-items: center; gap: 4px;
          white-space: nowrap; transition: all 0.18s;
        }
        .run-btn:hover:not(:disabled) { background: rgba(74,222,128,0.2); }
        .run-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .submit-btn {
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          color: #fff; border: none; padding: 5px 12px;
          border-radius: 8px; cursor: pointer; font-weight: 700;
          font-size: 0.8rem; display: flex; align-items: center; gap: 4px;
          white-space: nowrap; transition: all 0.2s;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .spin-sm {
          width: 11px; height: 11px;
          border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor;
          border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
        }

        /* ─── Workspace ─── */
        .workspace { flex: 1; overflow: hidden; min-height: 0; }

        /* ─── Verbal Layout ─── */
        .verbal-layout { height: 100%; display: grid; grid-template-columns: 1fr 1fr; }
        .interviewer-panel {
          background: rgba(8,8,14,0.6); border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 32px 40px; gap: 24px;
        }
        .avatar-section { display: flex; align-items: center; justify-content: center; }
        .interviewer-status { font-size: 0.82rem; min-height: 20px; text-align: center; }
        .candidate-panel {
          display: flex; flex-direction: column; padding: 24px; gap: 16px;
          overflow-y: auto; background: rgba(5,5,8,0.4);
        }
        .camera-section { flex-shrink: 0; }

        /* ─── Coding Layout ─── */
        .coding-layout { display: flex; height: 100%; }

        /* Problem Panel */
        .problem-panel {
          width: 36%; min-width: 240px; max-width: 400px;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 16px; overflow-y: auto; flex-shrink: 0;
          display: flex; flex-direction: column; gap: 12px;
        }
        .problem-head {
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 9px;
        }
        .problem-title { font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.88); }
        .problem-desc {
          font-size: 0.84rem; color: rgba(255,255,255,0.5); line-height: 1.8; margin: 0;
          white-space: pre-wrap;
        }
        .section-label {
          font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.8px;
          color: rgba(255,255,255,0.25); margin-bottom: 6px; font-weight: 700;
        }
        .constraints-box {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 10px 12px;
        }
        .constraint-item { font-size: 0.78rem; color: rgba(255,255,255,0.4); padding: 1px 0; }

        /* Test Cases (examples) */
        .testcases-section { display: flex; flex-direction: column; gap: 8px; }
        .example-box {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 9px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px;
        }
        .example-num { font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .case-row { display: flex; align-items: baseline; gap: 8px; }
        .case-key { font-size: 0.72rem; color: rgba(255,255,255,0.25); min-width: 46px; flex-shrink: 0; }
        .case-val {
          font-family: 'Fira Code', monospace; font-size: 0.78rem;
          color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.05);
          padding: 1px 6px; border-radius: 4px; word-break: break-all;
        }

        .expired-banner {
          background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5; padding: 7px 10px; border-radius: 8px; font-size: 0.8rem;
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

        /* Editor + Results column */
        .editor-column { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .editor-area { flex: 1; overflow: hidden; min-height: 0; }

        /* Results area */
        .results-area {
          flex-shrink: 0; display: flex; flex-direction: column;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(5,5,8,0.9);
          height: 32px; transition: height 0.25s ease;
        }
        .results-area.results-open { height: 260px; }
        .results-toggle {
          width: 100%; background: none; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 10px; padding: 0 14px;
          height: 32px; color: rgba(255,255,255,0.35); font-size: 0.78rem;
          justify-content: space-between;
        }
        .results-toggle:hover { color: rgba(255,255,255,0.6); }
        .results-toggle-close {
          width: 100%; background: none; border: none; cursor: pointer;
          display: flex; align-items: center; padding: 0 14px;
          height: 32px; color: rgba(255,255,255,0.3); font-size: 0.72rem;
          border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
        }
        .results-toggle-close:hover { color: rgba(255,255,255,0.55); }

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
