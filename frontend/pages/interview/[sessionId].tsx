import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Editor, { OnChange, OnMount } from '@monaco-editor/react';
import VoiceAssistant from '../../components/VoiceAssistant';
import { io, Socket } from 'socket.io-client';

// --- TYPES ---
interface TestCase {
  input: string;
  output: string;
}

interface Question {
  title: string;
  description: string;
  difficulty: string;
  constraints?: string[];
  testCases?: TestCase[];
  functionSignature?: string;
  example?: { input: unknown; output: unknown; explanation?: string };
}

interface SubmitResponse {
  score: number;
  verdict: string;
  feedback: string;
  improvements?: string[];
  nextQuestion?: Question;
  completed?: boolean;
  message?: string;
}

// --- 1. LANGUAGE TEMPLATES ---
const TEMPLATES: Record<string, string> = {
  javascript: `/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction solution(nums) {\n  // Write your logic here\n  return 0;\n}`,
  python: `def solution(nums):\n    # Write your logic here\n    return 0`,
  java: `class Solution {\n    public int solution(int[] nums) {\n        // Write your logic here\n        return 0;\n    }\n}`,
  cpp: `class Solution {\npublic:\n    int solution(vector<int>& nums) {\n        // Write your logic here\n        return 0;\n    }\n};`
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function InterviewPage() {
  const router = useRouter();
  const { sessionId } = router.query;

  // --- 2. STATE ---
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState(TEMPLATES.javascript);
  const [language, setLanguage] = useState('javascript');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isCodingStarted, setIsCodingStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [routerReady, setRouterReady] = useState(false);

  // --- 3. REFS ---
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // --- 4. WAIT FOR ROUTER HYDRATION ---
  useEffect(() => {
    if (router.isReady) {
      setRouterReady(true);
    }
  }, [router.isReady]);

  // --- 5. INITIALIZATION & SOCKET CONNECTION ---
  useEffect(() => {
    if (!sessionId || !routerReady) return;

    // A. Load Question Data
    axios.get<{ session: { question: Question; duration: number } }>(`${apiUrl}/api/interview/${sessionId}`)
      .then(res => {
        const session = res.data.session;
        setQuestion(session.question);
        setTimeLeft(session.duration || 1800);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load session", err);
        setLoading(false);
      });

    // B. Connect Socket (To send coding scores)
    const socket = io(apiUrl);
    socketRef.current = socket;

    return () => { socket.disconnect(); };

  }, [sessionId, routerReady]);

  // --- 5. TIMER SYNC ---
  useEffect(() => {
    if (isCodingStarted && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isCodingStarted, timeLeft]);

  // --- 6. HANDLERS ---
  
  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleEditorChange: OnChange = (value) => {
    setCode(value || "");
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    if (window.confirm(`Switch to ${newLang.toUpperCase()}? This will reset your current code.`)) {
      setLanguage(newLang);
      setCode(TEMPLATES[newLang]);
    }
  };

  // --- 3. UPDATED SUBMIT LOGIC ---
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post<SubmitResponse>(`${apiUrl}/api/interview/submit`, {
        sessionId,
        code,
        language,
      });

      if (socketRef.current) {
        socketRef.current.emit('submit_code_result', {
          sessionId,
          result: res.data,
        });
      }

      if (res.data.nextQuestion) {
        alert('Success! Moving to next question.');
        setQuestion(res.data.nextQuestion);
        setCode(TEMPLATES[language]);
      } else {
        alert(
          'Coding Round Complete! \n\nPlease click the green \'Finish Interview\' button on the AI Assistant to generate your Report Card.'
        );
      }
    } catch (err) {
      alert('Submission Error. Check console for details.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="loading">Initializing Interview...</div>;

  if (!sessionId || typeof sessionId !== 'string') {
    return <div className="loading">Loading session...</div>;
  }

  return (
    <div className="interview-layout">
      {/* Voice Assistant (Handling the Report Card UI) */}
      <VoiceAssistant sessionId={sessionId} onCodingStart={() => setIsCodingStarted(true)} />

      {/* HEADER / NAVIGATION */}
      <header className="nav">
        <div className="problem-info">
          <h1>{question?.title || "Technical Interview"}</h1>
          {isCodingStarted && <div className="timer">⏱ {formatTime(timeLeft)}</div>}
        </div>
        
        <div className="controls">
          <select value={language} onChange={handleLanguageChange} className="lang-select">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <button onClick={handleSubmit} disabled={submitting} className="submit-btn">
            {submitting ? "Running..." : "Submit Solution"}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="workspace">
        {!isCodingStarted ? (
          // PHASE 1: Conversation Mode
          <div className="pre-coding">
            <div className="ai-status">
              <span className="pulse-icon">🎙️</span>
              <h2>Verbal Interview in Progress</h2>
              <p>Please answer the interviewer&apos;s questions verbally.</p>
              <p className="subtext">The coding environment is locked until the theory round is complete.</p>
            </div>
          </div>
        ) : (
          // PHASE 2: Coding Mode
          <div className="coding-area">
            {/* Left Panel: Problem Description */}
            <div className="problem-panel">
              <h3>Problem Statement</h3>
              <p className="desc-text">{question?.description}</p>
              
              <div className="example-box">
                <h4>Example</h4>
                <pre>
<strong>Input:</strong> {JSON.stringify(question?.example?.input, null, 2)}
<strong>Output:</strong> {JSON.stringify(question?.example?.output)}
                </pre>
              </div>
            </div>

            {/* Right Panel: Code Editor */}
            <div className="editor-panel">
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16 }
                }}
              />
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .interview-layout { display: flex; flex-direction: column; height: 100vh; background: #1e1e1e; color: #fff; font-family: sans-serif; }
        .nav { height: 60px; background: #252526; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid #333; }
        .problem-info h1 { font-size: 1.1rem; margin: 0; color: #ccc; }
        .timer { font-family: monospace; font-size: 1.2rem; color: #4ade80; font-weight: bold; margin-left: 15px; }
        .controls { display: flex; gap: 10px; }
        .lang-select { background: #333; color: white; border: 1px solid #555; padding: 5px; border-radius: 4px; }
        .submit-btn { background: #0e639c; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .submit-btn:hover { background: #1177bb; }
        .submit-btn:disabled { background: #555; cursor: not-allowed; }
        .workspace { flex: 1; overflow: hidden; position: relative; }
        .pre-coding { height: 100%; display: flex; justify-content: center; align-items: center; background: #1e1e1e; }
        .ai-status { text-align: center; background: #252526; padding: 40px; border-radius: 12px; border: 1px solid #333; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .pulse-icon { font-size: 3rem; display: block; margin-bottom: 20px; animation: pulse 2s infinite; }
        .subtext { color: #888; font-size: 0.9rem; margin-top: 10px; }
        .coding-area { display: flex; height: 100%; }
        .problem-panel { width: 40%; background: #f3f4f6; color: #333; padding: 20px; overflow-y: auto; border-right: 1px solid #ccc; }
        .problem-panel h3 { margin-top: 0; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .desc-text { line-height: 1.6; }
        .example-box { background: #e5e7eb; padding: 15px; border-radius: 6px; margin-top: 20px; }
        .example-box pre { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 0.9rem; }
        .editor-panel { flex: 1; overflow: hidden; }
        .loading { display: flex; justify-content: center; align-items: center; height: 100vh; background: #1e1e1e; color: #888; }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}