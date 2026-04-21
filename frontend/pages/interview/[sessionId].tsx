import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import Editor, { OnChange } from '@monaco-editor/react';
import VoiceAssistant from '../../components/VoiceAssistant';
import CameraFeed from '../../components/CameraFeed';
import AIAvatar from '../../components/AIAvatar';
import type { Socket } from 'socket.io-client';

type Language = 'javascript' | 'python' | 'java' | 'cpp';
type ToastType = 'success' | 'error' | 'info';

interface PublicTestCase {
  id?: string;
  input: string;
  output: string;
  explanation?: string;
  sample?: boolean;
}

interface Question {
  id?: string;
  title: string;
  description: string;
  difficulty?: string;
  constraints?: string[];
  testCases?: PublicTestCase[];
  functionSignature?: string;
  inputFormat?: string;
  outputFormat?: string;
  starterCodeByLanguage?: Record<string, string>;
}

interface SessionPayload {
  question: Question | null;
  questions?: Question[];
  duration?: number;
  currentQuestionIndex?: number;
  status?: string;
  supportedLanguages?: string[];
  executionEnabled?: boolean;
}

interface CaseExecutionResult {
  testCaseId: string;
  label: string;
  hidden: boolean;
  passed: boolean;
  verdict: string;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  actualOutput?: string | null;
  expectedOutput?: string | null;
  stderr?: string | null;
}

interface ComplexityFeedback {
  estimatedTimeComplexity?: string;
  estimatedSpaceComplexity?: string;
  codeQualitySummary?: string;
  improvementSuggestions?: string[];
}

interface JudgeResult {
  mode: 'run' | 'submit';
  questionId?: string;
  questionTitle?: string;
  questionIndex?: number;
  score: number;
  passed: boolean;
  verdict: string;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  passedPublicCases: number;
  totalPublicCases: number;
  passedHiddenCases: number;
  totalHiddenCases: number;
  caseResults: CaseExecutionResult[];
  complexityFeedback?: ComplexityFeedback | null;
  message?: string;
  allPublicPassed?: boolean;
  nextQuestion?: Question;
  completed?: boolean;
}

const DEFAULT_TEMPLATES: Record<Language, string> = {
  javascript: `function solution(input) {\n  // Write your solution here\n  return input;\n}`,
  python: `def solution(input):\n    # Write your solution here\n    return input\n`,
  java: `class Solution {\n    public int solution(int input) {\n        // Write your solution here\n        return input;\n    }\n}\n`,
  cpp: `class Solution {\npublic:\n    int solution(int input) {\n        // Write your solution here\n        return input;\n    }\n};\n`,
};

const DEFAULT_LANGUAGES: Language[] = ['javascript', 'python', 'java', 'cpp'];
const TIME_WARNING_THRESHOLD = 300;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const DIFF_COLORS: Record<string, string> = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f87171',
};

const DIFFICULTY_LEVELS: Record<string, { label: string; color: string; progress: number }> = {
  warmup: { label: 'Introduction', color: '#4ade80', progress: 10 },
  easy: { label: 'Easy', color: '#60a5fa', progress: 35 },
  medium: { label: 'Medium', color: '#facc15', progress: 65 },
  hard: { label: 'Hard', color: '#f87171', progress: 90 },
};

function Toast({ message, type, onDismiss }: { message: string; type: ToastType; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const accent = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#60a5fa';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100,
        right: 24,
        background: 'rgba(10,10,16,0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${accent}`,
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 10,
        zIndex: 9999,
        maxWidth: 340,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.85rem',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.9rem' }}
      >
        ✕
      </button>
    </div>
  );
}

function LangConfirmModal({
  targetLang,
  onConfirm,
  onCancel,
}: {
  targetLang: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: 'rgba(15,15,20,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '28px 32px',
          textAlign: 'center',
          color: '#fff',
          maxWidth: 340,
        }}
      >
        <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>🔄</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Switch to {targetLang.toUpperCase()}?</h3>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 20, fontSize: '0.85rem' }}>
          Current code will be reset for this question.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Switch
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeLanguages(raw?: string[]): Language[] {
  const filtered = (raw || []).filter((lang): lang is Language => DEFAULT_LANGUAGES.includes(lang as Language));
  return filtered.length > 0 ? filtered : DEFAULT_LANGUAGES;
}

function starterCodeFor(question: Question | null, language: string): string {
  if (!question) return DEFAULT_TEMPLATES.javascript;
  return question.starterCodeByLanguage?.[language]?.trim() || DEFAULT_TEMPLATES[language as Language] || DEFAULT_TEMPLATES.javascript;
}

function formatTime(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

function languageLabel(language: string): string {
  return language.charAt(0).toUpperCase() + language.slice(1);
}

function verdictTone(verdict?: string): { color: string; background: string; border: string } {
  if (verdict === 'Accepted') {
    return { color: '#4ade80', background: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.25)' };
  }
  if (verdict === 'Compilation Error' || verdict === 'Runtime Error' || verdict === 'Time Limit Exceeded') {
    return { color: '#f87171', background: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)' };
  }
  if (verdict === 'Wrong Answer') {
    return { color: '#facc15', background: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.25)' };
  }
  return { color: '#60a5fa', background: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.25)' };
}

export default function InterviewPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { user } = useUser();

  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState(DEFAULT_TEMPLATES.javascript);
  const [language, setLanguage] = useState<Language>('javascript');
  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>(DEFAULT_LANGUAGES);
  const [executionEnabled, setExecutionEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isCodingStarted, setIsCodingStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routerReady, setRouterReady] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [pendingLang, setPendingLang] = useState<Language | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState('warmup');
  const [runPending, setRunPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [lastExecution, setLastExecution] = useState<JudgeResult | null>(null);
  const [resumeContext] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('resumeContext') || undefined;
  });

  const socketRef = useRef<Socket | null>(null);
  const languageRef = useRef<Language>('javascript');

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (router.isReady) setRouterReady(true);
  }, [router.isReady]);

  useEffect(() => {
    if (!sessionId || !routerReady) return;

    axios.get<{ session: SessionPayload }>(`${apiUrl}/api/interview/${sessionId}`)
      .then((res) => {
        const session = res.data.session;
        const nextLanguages = normalizeLanguages(session.supportedLanguages);
        const currentLanguage = languageRef.current;
        const initialLanguage = nextLanguages.includes(currentLanguage) ? currentLanguage : nextLanguages[0];

        setSupportedLanguages(nextLanguages);
        setExecutionEnabled(session.executionEnabled !== false);
        setQuestion(session.question);
        setLanguage(initialLanguage);
        setCode(starterCodeFor(session.question, initialLanguage));
        setTimeLeft(session.duration || 1800);
        setQuestionIndex(session.currentQuestionIndex || 0);
        setTotalQuestions(session.questions?.length || 3);
        setInterviewCompleted(session.status === 'completed');
        setLoading(false);
      })
      .catch(() => {
        showToast('Failed to load session.', 'error');
        setLoading(false);
      });
  }, [sessionId, routerReady, showToast]);

  useEffect(() => {
    if (!isCodingStarted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === TIME_WARNING_THRESHOLD) showToast('5 minutes remaining.', 'info');
        if (prev <= 1) {
          clearInterval(timer);
          setTimeExpired(true);
          showToast('Time is up. You can still submit your final code.', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCodingStarted, timeLeft, showToast]);

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const handleSocketReady = useCallback((socket: Socket) => { socketRef.current = socket; }, []);
  const handleCodingStart = useCallback(() => setIsCodingStarted(true), []);
  const handleSpeakingChange = useCallback((value: boolean) => setAiSpeaking(value), []);
  const handleEditorChange: OnChange = useCallback((value) => setCode(value || ''), []);
  const handleDifficultyChange = useCallback((level: string) => setDifficultyLevel(level), []);

  const handleCheatEvent = useCallback((type: string, detail?: string) => {
    socketRef.current?.emit('cheat_event', { sessionId, type, detail });
  }, [sessionId]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Language;
    if (next !== language) setPendingLang(next);
  };

  const confirmLanguageSwitch = () => {
    if (!pendingLang) return;
    setLanguage(pendingLang);
    setCode(starterCodeFor(question, pendingLang));
    setLastExecution(null);
    setPendingLang(null);
  };

  const handleRun = async () => {
    if (!executionEnabled) {
      showToast('Judge execution is not configured on the backend.', 'error');
      return;
    }
    if (!code.trim()) {
      showToast('Write some code first.', 'error');
      return;
    }

    setRunPending(true);
    try {
      const res = await axios.post<JudgeResult>(`${apiUrl}/api/interview/run`, {
        sessionId,
        code,
        language,
        userId: user?.id,
      });
      setLastExecution(res.data);

      if (res.data.allPublicPassed) showToast(res.data.message || 'All sample test cases passed.', 'success');
      else if (res.data.verdict === 'Compilation Error' || res.data.verdict === 'Runtime Error' || res.data.verdict === 'Time Limit Exceeded') {
        showToast(res.data.message || res.data.verdict, 'error');
      } else {
        showToast(res.data.message || 'Sample run finished.', 'info');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Run failed. Please try again.', 'error');
    } finally {
      setRunPending(false);
    }
  };

  const handleSubmit = async () => {
    if (!executionEnabled) {
      showToast('Judge execution is not configured on the backend.', 'error');
      return;
    }
    if (!code.trim()) {
      showToast('Write some code first.', 'error');
      return;
    }
    if (interviewCompleted) {
      showToast('Interview already completed.', 'info');
      return;
    }

    setSubmitPending(true);
    try {
      const res = await axios.post<JudgeResult>(`${apiUrl}/api/interview/submit`, {
        sessionId,
        code,
        language,
        userId: user?.id,
      });

      socketRef.current?.emit('submit_code_result', { sessionId, result: res.data });
      setLastExecution(res.data);

      if (res.data.nextQuestion) {
        const nextQuestion = res.data.nextQuestion;
        const nextIndex = res.data.questionIndex ?? questionIndex + 1;
        showToast(res.data.message || 'Accepted. Moving to the next question.', 'success');
        setQuestion(nextQuestion);
        setQuestionIndex(nextIndex);
        setCode(starterCodeFor(nextQuestion, language));
      } else if (res.data.completed) {
        setInterviewCompleted(true);
        showToast('All coding questions completed. Click Finish to get your report.', 'success');
      } else if (res.data.passed) {
        showToast(res.data.message || 'Accepted.', 'success');
      } else {
        showToast(res.data.message || 'Not accepted yet.', 'info');
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setInterviewCompleted(true);
        showToast('Interview already completed.', 'info');
      } else {
        showToast(err.response?.data?.error || 'Submission failed. Please try again.', 'error');
      }
    } finally {
      setSubmitPending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050508', color: 'rgba(255,255,255,0.4)', gap: 12, fontFamily: 'sans-serif' }}>
        <div style={{ width: 30, height: 30, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ margin: 0 }}>Initializing Interview...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!sessionId || typeof sessionId !== 'string') return null;

  const timerColor = timeLeft <= TIME_WARNING_THRESHOLD ? '#f87171' : '#4ade80';
  const activeLanguages = supportedLanguages.length > 0 ? supportedLanguages : DEFAULT_LANGUAGES;
  const activeCases = question?.testCases || [];
  const busy = runPending || submitPending;
  const verdictStyles = verdictTone(lastExecution?.verdict);
  const acceptedCases = lastExecution
    ? lastExecution.passedPublicCases + lastExecution.passedHiddenCases
    : 0;
  const totalEvaluatedCases = lastExecution
    ? lastExecution.totalPublicCases + lastExecution.totalHiddenCases
    : 0;
  const complexityFeedback = lastExecution?.complexityFeedback;

  return (
    <div className="root">
      {pendingLang && (
        <LangConfirmModal
          targetLang={pendingLang}
          onConfirm={confirmLanguageSwitch}
          onCancel={() => setPendingLang(null)}
        />
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

      <header className="header">
        <div className="header-left">
          <span className="brand">⚡ AI Interviewer</span>
          <div className="divider" />
          {!isCodingStarted ? (
            <span className="phase-label">Verbal Round</span>
          ) : (
            <>
              {question?.difficulty && (
                <span
                  className="diff-badge"
                  style={{
                    color: DIFF_COLORS[question.difficulty] || '#fff',
                    background: `${DIFF_COLORS[question.difficulty] || '#fff'}15`,
                    borderColor: `${DIFF_COLORS[question.difficulty] || '#fff'}40`,
                  }}
                >
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
              <div className="q-counter">Q {questionIndex + 1} / {Math.max(totalQuestions, 1)}</div>
              <div className="coding-timer" style={{ color: timerColor }}>
                ⏱ {formatTime(timeLeft)}
                {timeExpired && <span className="expired-tag">TIME UP</span>}
              </div>
              {interviewCompleted && <div className="complete-pill">Completed</div>}
            </>
          )}
        </div>
      </header>

      <main className="workspace">
        {!isCodingStarted ? (
          <div className="verbal-layout">
            <div className="interviewer-panel">
              <div className="avatar-section">
                <AIAvatar isSpeaking={aiSpeaking} difficulty_level={difficultyLevel as any} />
              </div>
              <div className="interviewer-status">
                {aiSpeaking
                  ? <span style={{ color: '#a855f7' }}>Alex is speaking...</span>
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
          <div className="coding-layout">
            <div className="problem-panel">
              <div className="problem-head">
                <span className="problem-title">{question?.title || 'Problem'}</span>
                {question?.difficulty && (
                  <span
                    style={{
                      color: DIFF_COLORS[question.difficulty] || '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                    }}
                  >
                    {question.difficulty}
                  </span>
                )}
              </div>

              {!executionEnabled && (
                <div className="judge-warning">
                  Judge execution is disabled on the backend. Configure Judge0 to enable Run and Submit.
                </div>
              )}

              <p className="problem-desc">{question?.description}</p>

              {question?.functionSignature && (
                <div className="signature-box">
                  <div className="section-label">Function Signature</div>
                  <code>{question.functionSignature}</code>
                </div>
              )}

              {(question?.inputFormat || question?.outputFormat) && (
                <div className="io-box">
                  <div className="section-label">Input / Output</div>
                  {question?.inputFormat && <p><strong>Input:</strong> {question.inputFormat}</p>}
                  {question?.outputFormat && <p><strong>Output:</strong> {question.outputFormat}</p>}
                </div>
              )}

              {question?.constraints && question.constraints.length > 0 && (
                <div className="constraints-box">
                  <div className="section-label">Constraints</div>
                  <ul className="constraints-list">
                    {question.constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeCases.length > 0 && (
                <div className="example-box">
                  <div className="example-head">Sample Test Cases</div>
                  {activeCases.map((tc, index) => (
                    <div key={tc.id || index} className="example-case">
                      <div className="case-label">Case {index + 1}</div>
                      <div className="case-row"><span className="case-key">Input</span><code>{tc.input}</code></div>
                      <div className="case-row"><span className="case-key">Output</span><code>{tc.output}</code></div>
                      {tc.explanation && <div className="case-explanation">{tc.explanation}</div>}
                      {index < activeCases.length - 1 && <hr className="case-divider" />}
                    </div>
                  ))}
                </div>
              )}

              {timeExpired && (
                <div className="expired-banner">Time expired. Editing is locked, but you can still submit your final solution.</div>
              )}

              <div className="q-dots">
                {Array.from({ length: Math.max(totalQuestions, 1) }).map((_, index) => (
                  <div
                    key={index}
                    className={`q-dot ${index < questionIndex ? 'q-done' : index === questionIndex ? 'q-cur' : ''}`}
                  />
                ))}
                <span className="q-dot-label">Question {questionIndex + 1} of {Math.max(totalQuestions, 1)}</span>
              </div>

              <div className="coding-camera">
                <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-toolbar">
                <div className="toolbar-left">
                  <div className={`judge-pill ${executionEnabled ? 'ready' : 'offline'}`}>
                    {executionEnabled ? 'Judge Ready' : 'Judge Offline'}
                  </div>
                  <select value={language} onChange={handleLanguageChange} className="lang-sel" disabled={busy || !isCodingStarted}>
                    {activeLanguages.map((lang) => (
                      <option key={lang} value={lang}>{languageLabel(lang)}</option>
                    ))}
                  </select>
                </div>

                <div className="toolbar-right">
                  {lastExecution && (
                    <div
                      className="verdict-pill"
                      style={{
                        color: verdictStyles.color,
                        background: verdictStyles.background,
                        borderColor: verdictStyles.border,
                      }}
                    >
                      {lastExecution.verdict}
                    </div>
                  )}
                  <button
                    onClick={handleRun}
                    disabled={busy || !isCodingStarted || !executionEnabled || !!pendingLang || !question}
                    className="run-btn"
                  >
                    {runPending ? <><span className="spin-sm" /> Running...</> : 'Run Code'}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={busy || !isCodingStarted || !executionEnabled || !!pendingLang || !question || interviewCompleted}
                    className="submit-btn"
                  >
                    {submitPending ? <><span className="spin-sm" /> Submitting...</> : 'Submit'}
                  </button>
                </div>
              </div>

              <div className="editor-shell">
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

              <div className="results-panel">
                <div className="results-head">
                  <div>
                    <div className="results-title">Judge Results</div>
                    <div className="results-subtitle">
                      {lastExecution?.questionTitle
                        ? `Results for ${lastExecution.questionTitle}`
                        : 'Run checks sample tests. Submit evaluates hidden tests too.'}
                    </div>
                  </div>
                </div>

                {!lastExecution ? (
                  <div className="results-empty">
                    <div className="empty-icon">🧪</div>
                    <div className="empty-title">No execution yet</div>
                    <p>Use <strong>Run Code</strong> to test sample cases and <strong>Submit</strong> for full judge evaluation.</p>
                  </div>
                ) : (
                  <>
                    <div className="summary-grid">
                      <div className="summary-card">
                        <span className="summary-label">Mode</span>
                        <strong>{lastExecution.mode === 'run' ? 'Run' : 'Submit'}</strong>
                      </div>
                      <div className="summary-card">
                        <span className="summary-label">Score</span>
                        <strong>{lastExecution.score}%</strong>
                      </div>
                      <div className="summary-card">
                        <span className="summary-label">Cases</span>
                        <strong>{acceptedCases}/{totalEvaluatedCases || 0}</strong>
                      </div>
                      <div className="summary-card">
                        <span className="summary-label">Runtime</span>
                        <strong>{lastExecution.runtimeMs != null ? `${lastExecution.runtimeMs} ms` : '—'}</strong>
                      </div>
                      <div className="summary-card">
                        <span className="summary-label">Memory</span>
                        <strong>{lastExecution.memoryKb != null ? `${lastExecution.memoryKb} KB` : '—'}</strong>
                      </div>
                      <div className="summary-card">
                        <span className="summary-label">Public / Hidden</span>
                        <strong>{lastExecution.passedPublicCases}/{lastExecution.totalPublicCases} • {lastExecution.passedHiddenCases}/{lastExecution.totalHiddenCases}</strong>
                      </div>
                    </div>

                    <div className="result-message">{lastExecution.message || 'Execution finished.'}</div>

                    {complexityFeedback && (
                      <div className="analysis-card">
                        <div className="analysis-head">
                          <div className="analysis-title">Complexity Feedback</div>
                          <div className="analysis-metrics">
                            <span>Time: {complexityFeedback.estimatedTimeComplexity || '—'}</span>
                            <span>Space: {complexityFeedback.estimatedSpaceComplexity || '—'}</span>
                          </div>
                        </div>

                        {complexityFeedback.codeQualitySummary && (
                          <p className="analysis-summary">{complexityFeedback.codeQualitySummary}</p>
                        )}

                        {complexityFeedback.improvementSuggestions && complexityFeedback.improvementSuggestions.length > 0 && (
                          <div className="analysis-suggestions">
                            {complexityFeedback.improvementSuggestions.map((suggestion) => (
                              <div key={suggestion} className="analysis-suggestion">{suggestion}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="case-results">
                      {lastExecution.caseResults.map((result) => (
                        <div key={result.testCaseId} className={`case-result ${result.passed ? 'passed' : 'failed'}`}>
                          <div className="case-result-head">
                            <div className="case-result-title">
                              <span>{result.label || (result.hidden ? 'Hidden Case' : 'Sample Case')}</span>
                              {result.hidden && <span className="hidden-pill">Hidden</span>}
                            </div>
                            <div className={`case-result-status ${result.passed ? 'passed' : 'failed'}`}>
                              {result.passed ? 'Passed' : result.verdict}
                            </div>
                          </div>

                          <div className="case-result-metrics">
                            <span>Runtime: {result.runtimeMs != null ? `${result.runtimeMs} ms` : '—'}</span>
                            <span>Memory: {result.memoryKb != null ? `${result.memoryKb} KB` : '—'}</span>
                          </div>

                          {!result.hidden && (
                            <div className="case-io-grid">
                              <div>
                                <div className="io-label">Expected</div>
                                <code>{result.expectedOutput || '—'}</code>
                              </div>
                              <div>
                                <div className="io-label">Actual</div>
                                <code>{result.actualOutput || '—'}</code>
                              </div>
                            </div>
                          )}

                          {result.stderr && (
                            <div className="stderr-box">
                              <div className="io-label">Details</div>
                              <pre>{result.stderr}</pre>
                            </div>
                          )}
                        </div>
                      ))}
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
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #050508;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
          position: relative;
        }

        .header {
          height: 52px;
          min-height: 52px;
          background: rgba(8,8,14,0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
          z-index: 10;
          gap: 10px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          min-width: 0;
        }

        .brand {
          font-weight: 700;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .divider {
          width: 1px;
          height: 18px;
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
        }

        .phase-label {
          font-size: 0.82rem;
          color: #a855f7;
          font-weight: 600;
          background: rgba(168,85,247,0.1);
          padding: 2px 10px;
          border-radius: 6px;
          border: 1px solid rgba(168,85,247,0.25);
        }

        .diff-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid;
          flex-shrink: 0;
          letter-spacing: 0.5px;
        }

        .q-title {
          font-size: 0.88rem;
          color: rgba(255,255,255,0.7);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .q-counter {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.04);
          padding: 3px 10px;
          border-radius: 8px;
        }

        .coding-timer {
          font-family: 'SF Mono', monospace;
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .expired-tag,
        .complete-pill {
          font-size: 0.58rem;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .expired-tag {
          background: #f87171;
          color: #000;
        }

        .complete-pill {
          background: rgba(74,222,128,0.14);
          color: #4ade80;
          border: 1px solid rgba(74,222,128,0.3);
        }

        .workspace {
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        .verbal-layout {
          height: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .interviewer-panel {
          background: rgba(8,8,14,0.6);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 40px;
          gap: 24px;
        }

        .avatar-section {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .interviewer-status {
          font-size: 0.82rem;
          min-height: 20px;
          text-align: center;
        }

        .candidate-panel {
          display: flex;
          flex-direction: column;
          padding: 24px;
          gap: 16px;
          overflow-y: auto;
          background: rgba(5,5,8,0.4);
        }

        .camera-section {
          flex-shrink: 0;
        }

        .coding-layout {
          display: flex;
          height: 100%;
        }

        .problem-panel {
          width: 36%;
          min-width: 280px;
          max-width: 460px;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 20px;
          overflow-y: auto;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .problem-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 10px;
          gap: 10px;
        }

        .problem-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
        }

        .problem-desc {
          font-size: 0.88rem;
          color: rgba(255,255,255,0.55);
          line-height: 1.75;
          margin: 0;
        }

        .judge-warning,
        .expired-banner {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .judge-warning {
          background: rgba(250,204,21,0.08);
          border: 1px solid rgba(250,204,21,0.18);
          color: #fde68a;
        }

        .expired-banner {
          background: rgba(248,113,113,0.07);
          border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5;
        }

        .signature-box,
        .io-box,
        .constraints-box,
        .example-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 12px 14px;
        }

        .section-label,
        .example-head {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: rgba(255,255,255,0.25);
          margin-bottom: 8px;
          font-weight: 700;
        }

        .signature-box code,
        .case-row code,
        .case-io-grid code {
          font-family: 'Fira Code', monospace;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.78);
          background: rgba(255,255,255,0.05);
          padding: 4px 6px;
          border-radius: 6px;
          display: inline-block;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .io-box p {
          margin: 0 0 6px;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.58);
          line-height: 1.6;
        }

        .io-box p:last-child {
          margin-bottom: 0;
        }

        .constraints-list {
          margin: 0;
          padding-left: 18px;
          color: rgba(255,255,255,0.58);
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .example-case {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .case-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: rgba(255,255,255,0.36);
        }

        .case-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .case-key {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.25);
          min-width: 52px;
          margin-top: 4px;
        }

        .case-explanation {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.4);
          line-height: 1.5;
        }

        .case-divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin: 8px 0;
        }

        .q-dots {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .q-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          transition: all 0.3s;
        }

        .q-done {
          background: rgba(74,222,128,0.4);
          border-color: #4ade80;
        }

        .q-cur {
          background: rgba(168,85,247,0.5);
          border-color: #a855f7;
        }

        .q-dot-label {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.25);
          margin-left: 2px;
        }

        .coding-camera {
          margin-top: auto;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .editor-panel {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(8,8,14,0.55), rgba(8,8,14,0.18));
        }

        .editor-toolbar {
          min-height: 58px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .toolbar-left,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .judge-pill,
        .verdict-pill {
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid;
          letter-spacing: 0.2px;
        }

        .judge-pill.ready {
          color: #4ade80;
          background: rgba(74,222,128,0.10);
          border-color: rgba(74,222,128,0.24);
        }

        .judge-pill.offline {
          color: #facc15;
          background: rgba(250,204,21,0.10);
          border-color: rgba(250,204,21,0.24);
        }

        .lang-sel {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 0.82rem;
          cursor: pointer;
          outline: none;
        }

        .lang-sel:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .run-btn,
        .submit-btn {
          border: none;
          padding: 8px 14px;
          border-radius: 9px;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .run-btn {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.86);
          border: 1px solid rgba(255,255,255,0.10);
        }

        .submit-btn {
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          color: #fff;
        }

        .run-btn:hover:not(:disabled),
        .submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .run-btn:disabled,
        .submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        .spin-sm {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .editor-shell {
          flex: 1;
          min-height: 0;
        }

        .results-panel {
          min-height: 250px;
          max-height: 320px;
          overflow-y: auto;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(5,5,8,0.6);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .results-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .results-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
        }

        .results-subtitle {
          font-size: 0.76rem;
          color: rgba(255,255,255,0.35);
          margin-top: 3px;
        }

        .results-empty {
          height: 100%;
          min-height: 170px;
          border: 1px dashed rgba(255,255,255,0.09);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: rgba(255,255,255,0.42);
          text-align: center;
          padding: 22px;
        }

        .empty-icon {
          font-size: 1.4rem;
        }

        .empty-title {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.72);
          font-weight: 700;
        }

        .results-empty p {
          margin: 0;
          max-width: 420px;
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .summary-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .summary-label {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .summary-card strong {
          font-size: 0.88rem;
          color: rgba(255,255,255,0.82);
        }

        .result-message {
          font-size: 0.84rem;
          color: rgba(255,255,255,0.62);
          line-height: 1.6;
        }

        .analysis-card {
          background: rgba(96,165,250,0.06);
          border: 1px solid rgba(96,165,250,0.16);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .analysis-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .analysis-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255,255,255,0.86);
        }

        .analysis-metrics {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .analysis-metrics span {
          font-size: 0.72rem;
          color: #93c5fd;
          background: rgba(96,165,250,0.12);
          border: 1px solid rgba(96,165,250,0.2);
          border-radius: 999px;
          padding: 4px 8px;
        }

        .analysis-summary {
          margin: 0;
          font-size: 0.82rem;
          line-height: 1.65;
          color: rgba(255,255,255,0.72);
        }

        .analysis-suggestions {
          display: grid;
          gap: 8px;
        }

        .analysis-suggestion {
          font-size: 0.78rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px 12px;
        }

        .case-results {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .case-result {
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .case-result.passed {
          border-color: rgba(74,222,128,0.18);
          background: rgba(74,222,128,0.05);
        }

        .case-result.failed {
          border-color: rgba(248,113,113,0.18);
          background: rgba(248,113,113,0.05);
        }

        .case-result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .case-result-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(255,255,255,0.82);
        }

        .hidden-pill {
          font-size: 0.66rem;
          padding: 2px 7px;
          border-radius: 999px;
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .case-result-status {
          font-size: 0.74rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
        }

        .case-result-status.passed {
          color: #4ade80;
          background: rgba(74,222,128,0.12);
        }

        .case-result-status.failed {
          color: #f87171;
          background: rgba(248,113,113,0.12);
        }

        .case-result-metrics {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          font-size: 0.76rem;
          color: rgba(255,255,255,0.38);
        }

        .case-io-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .io-label {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: rgba(255,255,255,0.28);
          margin-bottom: 6px;
        }

        .stderr-box {
          background: rgba(0,0,0,0.22);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px;
        }

        .stderr-box pre {
          margin: 0;
          font-family: 'Fira Code', monospace;
          font-size: 0.76rem;
          line-height: 1.5;
          color: #fca5a5;
          white-space: pre-wrap;
          word-break: break-word;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1024px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .verbal-layout {
            grid-template-columns: 1fr;
          }

          .interviewer-panel {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 24px;
          }

          .coding-layout {
            flex-direction: column;
          }

          .problem-panel {
            width: 100%;
            max-width: 100%;
            height: 44%;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .summary-grid,
          .case-io-grid {
            grid-template-columns: 1fr;
          }

          .results-panel {
            max-height: 38%;
          }
        }
      `}</style>
    </div>
  );
}
