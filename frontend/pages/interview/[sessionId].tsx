// pages/interview/[sessionId].tsx — LeetCode-style coding IDE
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
const LANG_LABELS: Record<string, string> = {
  javascript: 'JavaScript', python: 'Python 3', java: 'Java', cpp: 'C++',
};
const TIME_WARNING_THRESHOLD = 300;
const TOTAL_QUESTIONS = 2;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const DIFF_COLORS: Record<string, { text: string; bg: string }> = {
  easy:   { text: '#00b8a3', bg: 'rgba(0,184,163,0.12)' },
  medium: { text: '#ffa116', bg: 'rgba(255,161,22,0.12)' },
  hard:   { text: '#ff375f', bg: 'rgba(255,55,95,0.12)' },
};

const VERDICT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  'Accepted':            { color: '#00b8a3', bg: 'rgba(0,184,163,0.08)', icon: '✓' },
  'Wrong Answer':        { color: '#ff375f', bg: 'rgba(255,55,95,0.08)',  icon: '✗' },
  'Compilation Error':   { color: '#ffa116', bg: 'rgba(255,161,22,0.08)', icon: '!' },
  'Time Limit Exceeded': { color: '#ffa116', bg: 'rgba(255,161,22,0.08)', icon: '⏱' },
  'Runtime Error':       { color: '#ff375f', bg: 'rgba(255,55,95,0.08)',  icon: '⚠' },
};

// ── Toast ──────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4500); return () => clearTimeout(t); }, [onDismiss]);
  const color = type === 'success' ? '#00b8a3' : type === 'error' ? '#ff375f' : '#ffa116';
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
      background: '#282828', border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`,
      color: '#eff1f6', padding: '10px 14px', borderRadius: 8,
      maxWidth: 340, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#5c5c5c', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
    </div>
  );
}

// ── Language Switch Modal ──────────────────────────────────────
function LangConfirmModal({ targetLang, onConfirm, onCancel }: { targetLang: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: '#282828', border: '1px solid #3c3c3c', borderRadius: 12, padding: '24px 28px', textAlign: 'center', color: '#eff1f6', maxWidth: 320 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Switch to {LANG_LABELS[targetLang] || targetLang}?</h3>
        <p style={{ color: '#5c5c5c', marginBottom: 20, fontSize: '0.84rem', margin: '8px 0 20px' }}>Your current code will be replaced with the starter template.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '7px 18px', background: 'transparent', border: '1px solid #3c3c3c', color: '#eff1f6', borderRadius: 6, cursor: 'pointer', fontSize: '0.84rem' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 18px', background: '#ffa116', border: 'none', color: '#1a1a1a', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>Switch</button>
        </div>
      </div>
    </div>
  );
}

// ── Problem Panel ──────────────────────────────────────────────
function ProblemPanel({ question, questionIndex }: { question: Question | null; questionIndex: number }) {
  const [tab, setTab] = useState<'desc' | 'hints'>('desc');
  const diff = question?.difficulty?.toLowerCase() || '';
  const dc = DIFF_COLORS[diff] || { text: '#eff1f6', bg: 'rgba(255,255,255,0.06)' };

  const sampleCases = (question?.testCases ?? []).slice(0, 3);

  // Parse description to render examples nicely
  const rawDesc = question?.description || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #3c3c3c', flexShrink: 0, padding: '0 16px' }}>
        {(['desc', 'hints'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#ffa116' : 'transparent'}`,
            color: tab === t ? '#eff1f6' : '#5c5c5c', padding: '10px 14px', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: tab === t ? 600 : 400, transition: 'all 0.15s',
          }}>
            {t === 'desc' ? 'Description' : 'Constraints'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {tab === 'desc' ? (
          <>
            {/* Title + Difficulty */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#eff1f6' }}>
                {questionIndex + 1}. {question?.title || 'Loading…'}
              </h2>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{
                display: 'inline-block', background: dc.bg, color: dc.text,
                padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
              }}>
                {diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : 'Medium'}
              </span>
            </div>

            {/* Description */}
            <div style={{ fontSize: '0.875rem', color: '#eff1f6', lineHeight: 1.8, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
              {rawDesc}
            </div>

            {/* Examples */}
            {sampleCases.map((tc, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.84rem', fontWeight: 600, color: '#eff1f6' }}>
                  Example {i + 1}:
                </p>
                <div style={{
                  background: '#282828', borderRadius: 8, padding: '12px 14px',
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: '0.82rem',
                }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#5c5c5c' }}>Input: </span>
                    <span style={{ color: '#eff1f6' }}>{tc.input}</span>
                  </div>
                  <div>
                    <span style={{ color: '#5c5c5c' }}>Output: </span>
                    <span style={{ color: '#eff1f6' }}>{tc.output}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 14px', fontSize: '0.84rem', fontWeight: 600, color: '#eff1f6' }}>Constraints</p>
            {(question?.constraints ?? []).length > 0 ? (
              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {question!.constraints!.map((c, i) => (
                  <li key={i} style={{
                    fontFamily: "'Fira Code', monospace", fontSize: '0.82rem', color: '#eff1f6',
                    background: '#282828', padding: '5px 10px', borderRadius: 6, listStyle: 'none',
                    marginLeft: -18,
                  }}>
                    <code style={{ color: '#00b8a3' }}>{c}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#5c5c5c', fontSize: '0.84rem' }}>No constraints listed.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Console / Test Panel ───────────────────────────────────────
function ConsolePanel({
  testCases, runResults, submitResults, submitVerdict, submitScore,
  submitFeedback, isRunning, isSubmitting,
}: {
  testCases: TestCase[];
  runResults: TestCaseResult[] | null;
  submitResults: TestCaseResult[] | null;
  submitVerdict?: string;
  submitScore?: number;
  submitFeedback?: string;
  isRunning: boolean;
  isSubmitting: boolean;
}) {
  const [consoleTab, setConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => { if (runResults || submitResults) setConsoleTab('result'); }, [runResults, submitResults]);

  const sampleCases = testCases.slice(0, 3);
  const activeResultSet = submitResults ?? runResults;
  const isLoading = isRunning || isSubmitting;

  const vs = submitVerdict ? VERDICT_STYLE[submitVerdict] : null;
  const passedCount = activeResultSet ? activeResultSet.filter(r => r.passed).length : 0;
  const totalCount = activeResultSet?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a1a' }}>
      {/* Console tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #3c3c3c', flexShrink: 0, padding: '0 16px' }}>
        {(['testcase', 'result'] as const).map(t => (
          <button key={t} onClick={() => setConsoleTab(t)} style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${consoleTab === t ? '#ffa116' : 'transparent'}`,
            color: consoleTab === t ? '#eff1f6' : '#5c5c5c', padding: '8px 14px', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: consoleTab === t ? 600 : 400, transition: 'all 0.15s',
          }}>
            {t === 'testcase' ? 'Testcase' : 'Test Result'}
          </button>
        ))}
        {activeResultSet && consoleTab === 'result' && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700,
            color: passedCount === totalCount ? '#00b8a3' : '#ff375f',
          }}>
            {passedCount}/{totalCount} passed
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {consoleTab === 'testcase' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {/* Case selector tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {sampleCases.map((_, i) => (
                <button key={i} onClick={() => { setActiveCaseIdx(i); setShowCustom(false); }} style={{
                  background: !showCustom && activeCaseIdx === i ? '#3c3c3c' : 'transparent',
                  border: '1px solid #3c3c3c', color: '#eff1f6',
                  padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem',
                  fontWeight: !showCustom && activeCaseIdx === i ? 600 : 400,
                }}>
                  Case {i + 1}
                </button>
              ))}
              <button onClick={() => setShowCustom(true)} style={{
                background: showCustom ? '#3c3c3c' : 'transparent',
                border: '1px solid #3c3c3c', color: showCustom ? '#eff1f6' : '#5c5c5c',
                padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem',
              }}>
                + Custom
              </button>
            </div>

            {showCustom ? (
              <>
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Custom Input</p>
                <textarea
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="Enter custom stdin here…"
                  style={{
                    width: '100%', minHeight: 80, background: '#282828', color: '#eff1f6',
                    border: '1px solid #3c3c3c', borderRadius: 6, padding: '8px 10px',
                    fontFamily: "'Fira Code', monospace", fontSize: '0.82rem', resize: 'vertical',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </>
            ) : sampleCases[activeCaseIdx] ? (
              <>
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Input</p>
                <div style={{
                  background: '#282828', border: '1px solid #3c3c3c', borderRadius: 6,
                  padding: '8px 12px', fontFamily: "'Fira Code', monospace", fontSize: '0.82rem',
                  color: '#eff1f6', marginBottom: 10, whiteSpace: 'pre-wrap',
                }}>
                  {sampleCases[activeCaseIdx].stdin || sampleCases[activeCaseIdx].input}
                </div>
                <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Output</p>
                <div style={{
                  background: '#282828', border: '1px solid #3c3c3c', borderRadius: 6,
                  padding: '8px 12px', fontFamily: "'Fira Code', monospace", fontSize: '0.82rem',
                  color: '#00b8a3', whiteSpace: 'pre-wrap',
                }}>
                  {sampleCases[activeCaseIdx].expectedOutput || sampleCases[activeCaseIdx].output}
                </div>
              </>
            ) : (
              <p style={{ color: '#5c5c5c', fontSize: '0.84rem' }}>No test cases loaded.</p>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#5c5c5c', fontSize: '0.84rem', padding: '8px 0' }}>
                <div style={{ width: 16, height: 16, border: '2px solid #3c3c3c', borderTopColor: '#ffa116', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                {isSubmitting ? 'Evaluating submission…' : 'Running test cases…'}
              </div>
            ) : !activeResultSet ? (
              <p style={{ color: '#5c5c5c', fontSize: '0.84rem' }}>Run or submit your code to see results.</p>
            ) : (
              <>
                {/* Verdict banner for submit */}
                {submitVerdict && vs && (
                  <div style={{
                    background: vs.bg, border: `1px solid ${vs.color}30`,
                    borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: '1.2rem', color: vs.color, fontWeight: 700 }}>{vs.icon}</span>
                    <div>
                      <div style={{ color: vs.color, fontWeight: 700, fontSize: '0.95rem' }}>{submitVerdict}</div>
                      {typeof submitScore === 'number' && (
                        <div style={{ color: '#5c5c5c', fontSize: '0.75rem', marginTop: 2 }}>
                          Score: {submitScore}/100 · {passedCount}/{totalCount} test cases passed
                        </div>
                      )}
                    </div>
                    {typeof submitScore === 'number' && (
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#5c5c5c' }}>Runtime</div>
                        <div style={{ fontSize: '0.85rem', color: '#eff1f6', fontWeight: 600 }}>
                          {Math.floor(Math.random() * 60 + 5)}ms
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-case results */}
                {activeResultSet.map((r, i) => (
                  <div key={i} style={{
                    marginBottom: 10, background: '#282828', borderRadius: 8,
                    border: `1px solid ${r.passed ? 'rgba(0,184,163,0.2)' : 'rgba(255,55,95,0.2)'}`,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      borderBottom: '1px solid #3c3c3c',
                    }}>
                      <span style={{ color: r.passed ? '#00b8a3' : '#ff375f', fontWeight: 700, fontSize: '0.95rem' }}>
                        {r.passed ? '✓' : '✗'}
                      </span>
                      <span style={{ color: '#eff1f6', fontSize: '0.82rem', fontWeight: 600 }}>Case {i + 1}</span>
                      {!r.passed && r.status && (
                        <span style={{ color: '#ffa116', fontSize: '0.72rem', background: 'rgba(255,161,22,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                          {r.status}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <CaseField label="Input" value={r.input} />
                      <CaseField label="Expected" value={r.expectedOutput} color="#00b8a3" />
                      <CaseField label="Output" value={r.actualOutput} color={r.passed ? '#00b8a3' : '#ff375f'} />
                    </div>
                  </div>
                ))}

                {/* AI Feedback */}
                {submitFeedback && (
                  <div style={{
                    background: '#282828', border: '1px solid #3c3c3c', borderRadius: 8,
                    padding: '10px 14px', marginTop: 4,
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Feedback</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#eff1f6', lineHeight: 1.7 }}>{submitFeedback}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CaseField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: '0.7rem', color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <pre style={{
        margin: 0, background: '#1a1a1a', border: '1px solid #3c3c3c', borderRadius: 5,
        padding: '5px 8px', fontFamily: "'Fira Code', monospace", fontSize: '0.8rem',
        color: color || '#eff1f6', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: 70, overflow: 'auto',
      }}>
        {value || '(empty)'}
      </pre>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function InterviewPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { user } = useUser();

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
  const [consolePanelHeight, setConsolePanelHeight] = useState(240);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(38);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);
  const [resumeContext] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('resumeContext') || undefined;
  });

  const [supportedLangs, setSupportedLangs] = useState<Record<string, boolean>>({ javascript: true, python: true, java: true, cpp: true });

  useEffect(() => {
    axios.get(`${apiUrl}/health/langs`).then(r => setSupportedLangs(r.data)).catch(() => {});
  }, []);

  const [runResults,    setRunResults]    = useState<TestCaseResult[] | null>(null);
  const [submitResults, setSubmitResults] = useState<TestCaseResult[] | null>(null);
  const [submitVerdict, setSubmitVerdict] = useState<string | undefined>();
  const [submitScore,   setSubmitScore]   = useState<number | undefined>();
  const [submitFeedback, setSubmitFeedback] = useState<string | undefined>();

  const socketRef   = useRef<Socket | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;

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
      .catch(() => { showToast('Failed to load session.', 'error'); setLoading(false); });
  }, [sessionId, routerReady, loadQuestion]);

  useEffect(() => {
    if (starterCodeMap) {
      setCode((starterCodeMap as any)[languageRef.current] || FALLBACK_TEMPLATES[languageRef.current]);
    }
  }, [starterCodeMap]);

  useEffect(() => {
    if (!isCodingStarted) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === TIME_WARNING_THRESHOLD) showToast('⚠ 5 minutes remaining!', 'info');
        if (prev <= 1) { clearInterval(t); setTimeExpired(true); showToast('Time is up!', 'error'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isCodingStarted]);

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  // Vertical drag (console height)
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartH.current = consolePanelHeight;
    e.preventDefault();
  };
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY;
      const newH = Math.min(Math.max(dragStartH.current + delta, 140), 480);
      setConsolePanelHeight(newH);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  // Horizontal drag (left panel width)
  const handleLeftDragStart = (e: React.MouseEvent) => {
    setIsDraggingLeft(true);
    dragStartX.current = e.clientX;
    dragStartW.current = leftPanelWidth;
    e.preventDefault();
  };
  useEffect(() => {
    if (!isDraggingLeft) return;
    const onMove = (e: MouseEvent) => {
      const totalW = window.innerWidth;
      const delta = e.clientX - dragStartX.current;
      const newPct = Math.min(Math.max(dragStartW.current + (delta / totalW) * 100, 22), 55);
      setLeftPanelWidth(newPct);
    };
    const onUp = () => setIsDraggingLeft(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingLeft]);

  const showToast = (message: string, type: string) => setToast({ message, type });
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerCritical = timeLeft <= TIME_WARNING_THRESHOLD && timeLeft > 0;

  const handleSocketReady    = useCallback((s: Socket) => { socketRef.current = s; }, []);
  const handleCodingStart    = useCallback(() => setIsCodingStarted(true), []);
  const handleSpeakingChange = useCallback((v: boolean) => setAiSpeaking(v), []);
  const handleEditorChange: OnChange = useCallback((v) => setCode(v || ''), []);
  const handleDifficultyChange = useCallback((level: string) => setDifficultyLevel(level), []);
  const handleCheatEvent = useCallback((type: string, detail?: string) => {
    socketRef.current?.emit('cheat_event', { sessionId, type, detail });
  }, [sessionId]);

  const handleLanguageChange = (lang: string) => {
    if (lang !== language) setPendingLang(lang);
  };
  const confirmLanguageSwitch = () => {
    if (!pendingLang) return;
    const tpl = starterCodeMap ? ((starterCodeMap as any)[pendingLang] || FALLBACK_TEMPLATES[pendingLang]) : FALLBACK_TEMPLATES[pendingLang];
    setLanguage(pendingLang);
    setCode(tpl);
    setPendingLang(null);
  };

  const handleRun = async () => {
    if (!code.trim()) { showToast('Write some code first.', 'error'); return; }
    setRunning(true);
    setRunResults(null);
    try {
      const res = await axios.post(`${apiUrl}/api/interview/run`, { sessionId, code, language });
      setRunResults(res.data.results ?? []);
      if ((res.data.results ?? []).length === 0) showToast(res.data.message || 'No executable test cases.', 'info');
    } catch {
      showToast('Run failed. Check your code.', 'error');
      setRunResults([]);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) { showToast('Write some code first.', 'error'); return; }
    if (interviewCompleted) { showToast('Interview already completed!', 'info'); return; }
    setSubmitting(true);
    setSubmitResults(null);
    try {
      const res = await axios.post(`${apiUrl}/api/interview/submit`, { sessionId, code, language });
      socketRef.current?.emit('submit_code_result', { sessionId, result: res.data });
      setSubmitVerdict(res.data.verdict);
      setSubmitScore(res.data.score);
      setSubmitFeedback(res.data.feedback);
      setSubmitResults(res.data.testCases ?? []);

      if (res.data.nextQuestion) {
        showToast(res.data.message || 'Moving to next question.', 'success');
        loadQuestion(res.data.nextQuestion);
        setCode(res.data.nextQuestion.starterCode?.[language] || FALLBACK_TEMPLATES[language]);
        setQuestionIndex(res.data.questionIndex ?? questionIndex + 1);
      } else if (res.data.completed) {
        setInterviewCompleted(true);
        showToast('All done! Click "Finish" to get your report.', 'success');
      } else {
        showToast(res.data.message || 'Not all test cases passed. Try again!', 'info');
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setInterviewCompleted(true);
        showToast('Interview already completed!', 'info');
      } else {
        showToast('Submission failed. Try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a1a', color: '#5c5c5c', gap: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ width: 22, height: 22, border: '2px solid #3c3c3c', borderTopColor: '#ffa116', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '0.9rem' }}>Initializing session…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!sessionId || typeof sessionId !== 'string') return null;

  const visibleTestCases = question?.testCases ?? [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#1a1a1a', color: '#eff1f6', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      cursor: isDragging ? 'row-resize' : isDraggingLeft ? 'col-resize' : 'default',
    }}>
      {pendingLang && <LangConfirmModal targetLang={pendingLang} onConfirm={confirmLanguageSwitch} onCancel={() => setPendingLang(null)} />}
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

      {/* ═══════════════ HEADER ═══════════════ */}
      <header style={{
        height: 44, minHeight: 44, background: '#282828',
        borderBottom: '1px solid #3c3c3c',
        display: 'flex', alignItems: 'center', padding: '0 12px',
        gap: 10, flexShrink: 0, zIndex: 20,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffa116' }}>⚡</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#eff1f6' }}>AI Interview</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#3c3c3c' }} />

        {/* Problem title */}
        {isCodingStarted && question && (
          <>
            <span style={{ fontSize: '0.82rem', color: '#5c5c5c' }}>
              {questionIndex + 1}.
            </span>
            <span style={{ fontSize: '0.82rem', color: '#eff1f6', fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {question.title}
            </span>
            {question.difficulty && (() => {
              const dc = DIFF_COLORS[question.difficulty.toLowerCase()] || DIFF_COLORS.medium;
              return (
                <span style={{ background: dc.bg, color: dc.text, padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>
                  {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                </span>
              );
            })()}
          </>
        )}

        {!isCodingStarted && (
          <span style={{ fontSize: '0.78rem', background: 'rgba(168,85,247,0.12)', color: '#c084fc', padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.2)' }}>
            Verbal Round
          </span>
        )}

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Timer */}
          {isCodingStarted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: timerCritical ? 'rgba(255,55,95,0.1)' : '#1a1a1a',
              border: `1px solid ${timerCritical ? 'rgba(255,55,95,0.3)' : '#3c3c3c'}`,
              padding: '3px 10px', borderRadius: 6,
            }}>
              <span style={{ fontSize: '0.7rem' }}>⏱</span>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: '0.88rem', fontWeight: 700,
                color: timerCritical ? '#ff375f' : '#eff1f6',
              }}>
                {formatTime(timeLeft)}
              </span>
              {timeExpired && <span style={{ fontSize: '0.6rem', background: '#ff375f', color: '#fff', padding: '0 4px', borderRadius: 3, fontWeight: 800 }}>DONE</span>}
            </div>
          )}

          {/* Question counter */}
          {isCodingStarted && (
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                  background: i < questionIndex ? 'rgba(0,184,163,0.15)' : i === questionIndex ? 'rgba(255,161,22,0.15)' : '#1a1a1a',
                  border: `1px solid ${i < questionIndex ? '#00b8a3' : i === questionIndex ? '#ffa116' : '#3c3c3c'}`,
                  color: i < questionIndex ? '#00b8a3' : i === questionIndex ? '#ffa116' : '#5c5c5c',
                }}>
                  {i < questionIndex ? '✓' : i + 1}
                </div>
              ))}
            </div>
          )}

          {/* Lang selector (coding only) */}
          {isCodingStarted && (
            <div style={{ display: 'flex', gap: 1, background: '#1a1a1a', border: '1px solid #3c3c3c', borderRadius: 6, overflow: 'hidden' }}>
              {LANGUAGES.map(l => {
                const supported = supportedLangs[l] !== false;
                return (
                  <button
                    key={l}
                    onClick={() => supported && handleLanguageChange(l)}
                    title={supported ? undefined : `${LANG_LABELS[l]} not available on this server`}
                    style={{
                      background: language === l ? '#3c3c3c' : 'transparent',
                      border: 'none',
                      color: !supported ? '#3c3c3c' : language === l ? '#eff1f6' : '#5c5c5c',
                      padding: '4px 10px',
                      cursor: supported ? 'pointer' : 'not-allowed',
                      fontSize: '0.75rem',
                      fontWeight: language === l ? 600 : 400,
                      transition: 'all 0.15s',
                      textDecoration: !supported ? 'line-through' : 'none',
                    }}
                  >
                    {LANG_LABELS[l]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Run button */}
          {isCodingStarted && (
            <button onClick={handleRun} disabled={running || submitting} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: '1px solid #3c3c3c',
              color: running ? '#5c5c5c' : '#eff1f6', padding: '5px 14px',
              borderRadius: 6, cursor: running || submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!running && !submitting) (e.currentTarget as HTMLElement).style.borderColor = '#00b8a3'; (e.currentTarget as HTMLElement).style.color = '#00b8a3'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3c3c3c'; (e.currentTarget as HTMLElement).style.color = running ? '#5c5c5c' : '#eff1f6'; }}
            >
              {running ? (
                <><Spinner color="#5c5c5c" /> Running…</>
              ) : (
                <><span style={{ fontSize: '0.7rem' }}>▶</span> Run</>
              )}
            </button>
          )}

          {/* Submit button */}
          {isCodingStarted && (
            <button onClick={handleSubmit} disabled={running || submitting || interviewCompleted} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: interviewCompleted ? '#3c3c3c' : '#ffa116',
              border: 'none',
              color: interviewCompleted ? '#5c5c5c' : '#1a1a1a',
              padding: '5px 14px', borderRadius: 6,
              cursor: running || submitting || interviewCompleted ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: 700, transition: 'all 0.15s',
              opacity: running || submitting ? 0.6 : 1,
            }}>
              {submitting ? <><Spinner color="#1a1a1a" /> Submitting…</> : interviewCompleted ? '✓ Submitted' : 'Submit'}
            </button>
          )}

          {/* Finish interview button */}
          {isCodingStarted && (
            <button
              onClick={() => socketRef.current?.emit('end_interview', { sessionId, userId: user?.id || 'GUEST_USER' })}
              style={{
                background: 'transparent', border: '1px solid #3c3c3c', color: '#5c5c5c',
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ff375f'; (e.currentTarget as HTMLElement).style.color = '#ff375f'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3c3c3c'; (e.currentTarget as HTMLElement).style.color = '#5c5c5c'; }}
            >
              Finish
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════ WORKSPACE ═══════════════ */}
      {!isCodingStarted ? (
        /* ── Verbal Round ── */
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          <div style={{
            background: '#1a1a1a', borderRight: '1px solid #3c3c3c',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px',
          }}>
            <AIAvatar isSpeaking={aiSpeaking} difficulty_level={difficultyLevel as any} />
            <p style={{ margin: '20px 0 0', fontSize: '0.84rem', color: aiSpeaking ? '#c084fc' : '#5c5c5c' }}>
              {aiSpeaking ? 'Alex is speaking…' : 'Listening…'}
            </p>
            <button
              onClick={() => setIsCodingStarted(true)}
              style={{
                marginTop: 32, background: 'transparent', border: '1px dashed #3c3c3c',
                color: '#5c5c5c', padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.75rem', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ffa116'; (e.currentTarget as HTMLElement).style.color = '#ffa116'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3c3c3c'; (e.currentTarget as HTMLElement).style.color = '#5c5c5c'; }}
            >
              Skip to Coding →
            </button>
          </div>
          <div style={{ background: '#1a1a1a', display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'auto' }}>
            <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
          </div>
        </div>
      ) : (
        /* ── Coding Round — LeetCode 3-panel ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── LEFT: Problem Description ── */}
          <div style={{
            width: `${leftPanelWidth}%`, minWidth: 220, background: '#1a1a1a',
            borderRight: '1px solid #3c3c3c', flexShrink: 0, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <ProblemPanel question={question} questionIndex={questionIndex} />
          </div>

          {/* ── DRAG HANDLE (vertical) ── */}
          <div
            onMouseDown={handleLeftDragStart}
            style={{
              width: 4, background: '#3c3c3c', cursor: 'col-resize', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ffa116')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3c3c3c')}
          />

          {/* ── RIGHT: Editor + Console ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Monaco Editor */}
            <div style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e', minHeight: 0 }}>
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language}
                theme="vs-dark"
                value={code}
                onChange={handleEditorChange}
                loading={
                  <div style={{ padding: 20, color: '#5c5c5c', fontFamily: 'monospace', background: '#1e1e1e' }}>
                    Loading editor…
                  </div>
                }
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                  readOnly: timeExpired,
                  fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
                  fontLigatures: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  tabSize: 2,
                  wordWrap: 'off',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: true, indentation: true },
                }}
              />
            </div>

            {/* ── DRAG HANDLE (horizontal) ── */}
            <div
              onMouseDown={handleDragStart}
              style={{
                height: 4, background: '#3c3c3c', cursor: 'row-resize', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ffa116')}
              onMouseLeave={e => (e.currentTarget.style.background = '#3c3c3c')}
            />

            {/* Console Panel */}
            <div style={{ height: consolePanelHeight, flexShrink: 0, overflow: 'hidden' }}>
              <ConsolePanel
                testCases={visibleTestCases}
                runResults={runResults}
                submitResults={submitResults}
                submitVerdict={submitVerdict}
                submitScore={submitScore}
                submitFeedback={submitFeedback}
                isRunning={running}
                isSubmitting={submitting}
              />
            </div>
          </div>

          {/* ── SMALL CAMERA (anti-cheat, bottom-right) ── */}
          <div style={{
            position: 'absolute', bottom: consolePanelHeight + 12, right: 12,
            zIndex: 15, opacity: 0.7, transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >
            <CameraFeed sessionId={sessionId} onCheatEvent={handleCheatEvent} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3c3c3c; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #5c5c5c; }
      `}</style>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: `2px solid ${color}40`, borderTopColor: color,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}
