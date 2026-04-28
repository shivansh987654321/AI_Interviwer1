// pages/index.tsx
import { useUser, SignOutButton } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useState, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';

type Difficulty = 'easy' | 'medium' | 'hard';

interface CreateInterviewResponse {
  sessionId: string;
  question: { title: string; description: string; testCases?: { input: string; output: string }[] };
}

type DifficultyConfig = {
  label: string; duration: string; color: string; glow: string; desc: string; icon: string;
};

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: 'Easy',   duration: '15 min', color: '#4ade80', glow: 'rgba(74,222,128,0.15)',  desc: 'Arrays, strings, basic logic',   icon: '🟢' },
  medium: { label: 'Medium', duration: '30 min', color: '#facc15', glow: 'rgba(250,204,21,0.15)',  desc: 'Trees, sorting, two pointers',   icon: '🟡' },
  hard:   { label: 'Hard',   duration: '45 min', color: '#f87171', glow: 'rgba(248,113,113,0.15)', desc: 'DP, graphs, advanced algorithms', icon: '🔴' },
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ---- Resume text extractor (client-side, PDF.js-free simple approach) ----
async function extractResumeText(file: File): Promise<string> {
  // For .txt files — direct read
  if (file.type === 'text/plain') {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target?.result as string) || '');
      reader.readAsText(file);
    });
  }
  // For PDF/DOCX: send to backend for extraction
  try {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await axios.post(`${apiUrl}/api/interview/parse-resume`, formData);
    return res.data.text || '';
  } catch { /* fall through */ }
  // Fallback: just store filename as context hint
  return `Resume file: ${file.name}`;
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'parsing' | 'ready' | 'error'>('idle');
  const [resumeName, setResumeName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setResumeName(file.name);
    setResumeStatus('parsing');
    try {
      const text = await extractResumeText(file);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('resumeContext', text.substring(0, 3000));
      }
      setResumeStatus('ready');
    } catch {
      setResumeStatus('error');
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    setResumeName('');
    setResumeStatus('idle');
    if (typeof window !== 'undefined') sessionStorage.removeItem('resumeContext');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartInterview = async () => {
    if (!selectedDifficulty) return;
    if (!user) { router.push('/sign-in'); return; }
    setLoading(true); setErrorMsg('');
    try {
      const response = await axios.post<CreateInterviewResponse>(
        `${apiUrl}/api/interview/create`,
        { difficulty: selectedDifficulty, userId: user.id }
      );
      router.push(`/interview/${response.data.sessionId}`);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Failed to connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="root">
      <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-inner">
          <span className="nav-brand"><span className="brand-icon">⚡</span>AI Interviewer</span>
          <div className="nav-links">
            {isLoaded && user ? (
              <>
                <Link href="/history" className="nav-link">📋 History</Link>
                <span className="nav-user">{user.firstName || user.emailAddresses[0]?.emailAddress}</span>
                <SignOutButton><button className="nav-btn">Sign Out</button></SignOutButton>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="nav-btn">Sign In</Link>
                <Link href="/sign-up" className="nav-btn nav-btn-primary">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="hero-text">
          <div className="badge">🤖 AI-Powered Mock Interviews</div>
          <h1>Ace Your Next<br /><span className="gradient-text">Tech Interview</span></h1>
          <p className="hero-sub">
            {user
              ? `Welcome back, ${user.firstName || 'there'}! Ready to practice?`
              : 'Real DSA problems. Real-time AI feedback. Voice interview included.'}
          </p>
        </div>

        <div className="glass-card">
          {/* Resume upload section */}
          <div className="resume-section">
            <div className="resume-header">
              <div>
                <div className="resume-title">📄 Resume Upload <span className="optional-tag">optional</span></div>
                <div className="resume-sub">Upload your resume for personalized questions about your projects</div>
              </div>
            </div>

            {resumeStatus === 'idle' ? (
              <button className="resume-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon">⬆</span>
                Upload PDF, DOCX, or TXT
              </button>
            ) : (
              <div className={`resume-status-box ${resumeStatus}`}>
                <div className="resume-file-info">
                  <span className="file-icon">
                    {resumeStatus === 'parsing' ? '⏳' : resumeStatus === 'ready' ? '✅' : '⚠️'}
                  </span>
                  <span className="file-name">{resumeName}</span>
                  <span className="file-status">
                    {resumeStatus === 'parsing' ? 'Parsing...' : resumeStatus === 'ready' ? 'Ready' : 'Parse failed'}
                  </span>
                </div>
                <button className="remove-btn" onClick={handleRemoveResume}>✕</button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleResumeChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="section-divider" />

          <h2>Select Difficulty</h2>
          <p className="card-sub">Choose a level that matches your preparation</p>

          <div className="diff-grid">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, DifficultyConfig][]).map(([level, cfg]) => (
              <button
                key={level}
                className={`diff-card ${selectedDifficulty === level ? 'selected' : ''}`}
                onClick={() => setSelectedDifficulty(level)}
                disabled={loading}
                style={selectedDifficulty === level ? {
                  borderColor: cfg.color,
                  boxShadow: `0 0 0 1px ${cfg.color}, 0 8px 32px ${cfg.glow}`,
                  background: `linear-gradient(135deg, ${cfg.glow}, rgba(255,255,255,0.03))`,
                } : {}}
              >
                <div className="diff-top">
                  <span className="diff-icon">{cfg.icon}</span>
                  <span className="diff-label" style={selectedDifficulty === level ? { color: cfg.color } : {}}>
                    {cfg.label}
                  </span>
                </div>
                <span className="diff-duration">⏱ {cfg.duration}</span>
                <span className="diff-desc">{cfg.desc}</span>
                {selectedDifficulty === level && (
                  <span className="diff-check" style={{ color: cfg.color }}>✓ Selected</span>
                )}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="error-box">
              <span>⚠️ {errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="error-dismiss">✕</button>
            </div>
          )}

          <button
            className="start-btn"
            onClick={handleStartInterview}
            disabled={!selectedDifficulty || loading}
          >
            {loading ? (
              <span className="btn-inner"><span className="spinner" />Generating Questions...</span>
            ) : !user ? (
              '🔒 Sign In to Start'
            ) : selectedDifficulty ? (
              `Start ${DIFFICULTY_CONFIG[selectedDifficulty].label} Interview →`
            ) : (
              'Select a Difficulty'
            )}
          </button>

          {user && (
            <p className="history-hint"><Link href="/history">View past interviews →</Link></p>
          )}
        </div>

        {/* What to expect */}
        <div className="expect-section">
          <h3 className="expect-title">What to expect</h3>
          <div className="expect-grid">
            {[
              { icon: '🎤', label: '10 min verbal', desc: 'Voice Q&A with AI' },
              { icon: '💻', label: 'DSA coding', desc: '3 progressive problems' },
              { icon: '📊', label: 'Report card', desc: 'Detailed feedback' },
            ].map(item => (
              <div key={item.label} className="expect-item">
                <span className="expect-icon">{item.icon}</span>
                <span className="expect-label">{item.label}</span>
                <span className="expect-desc">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        .root {
          min-height: 100vh; background: #050508; color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex; flex-direction: column; align-items: center;
          position: relative; overflow: hidden;
        }
        .orb {
          position: fixed; border-radius: 50%; filter: blur(80px);
          opacity: 0.22; pointer-events: none;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .orb1 { width: 600px; height: 600px; background: radial-gradient(circle,#7c3aed,transparent); top: -200px; left: -200px; }
        .orb2 { width: 500px; height: 500px; background: radial-gradient(circle,#2563eb,transparent); bottom: -150px; right: -150px; animation-delay: 4s; }
        .orb3 { width: 400px; height: 400px; background: radial-gradient(circle,#db2777,transparent); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: 8s; }
        @keyframes drift { from{transform:translate(0,0) scale(1)} to{transform:translate(30px,-30px) scale(1.05)} }

        .navbar {
          width: 100%; position: relative; z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(5,5,8,0.6); backdrop-filter: blur(12px);
        }
        .nav-inner { max-width: 1100px; margin: 0 auto; padding: 0.9rem 2rem; display: flex; align-items: center; justify-content: space-between; }
        .nav-brand { font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
        .brand-icon { font-size: 1.1rem; }
        .nav-links { display: flex; align-items: center; gap: 0.6rem; }
        .nav-link { text-decoration: none; color: rgba(255,255,255,0.5); font-size: 0.88rem; padding: 0.35rem 0.75rem; border-radius: 8px; transition: all 0.2s; }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .nav-user { font-size: 0.82rem; color: rgba(255,255,255,0.35); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-btn { padding: 0.4rem 0.9rem; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; transition: all 0.2s; backdrop-filter: blur(8px); }
        .nav-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.08); }
        .nav-btn-primary { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.4); color: #d8b4fe; }

        .main { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 3rem 1.5rem 4rem; width: 100%; max-width: 580px; gap: 2rem; }

        .hero-text { text-align: center; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.9rem; background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.25); border-radius: 999px; font-size: 0.8rem; color: #c4b5fd; margin-bottom: 1.25rem; backdrop-filter: blur(8px); }
        h1 { font-size: 2.8rem; font-weight: 800; line-height: 1.15; margin: 0 0 1rem; letter-spacing: -1px; }
        .gradient-text { background: linear-gradient(135deg,#a855f7 0%,#ec4899 50%,#f97316 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-sub { font-size: 1rem; color: rgba(255,255,255,0.45); margin: 0; line-height: 1.6; }

        .glass-card {
          width: 100%; background: rgba(255,255,255,0.04); backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
          padding: 1.75rem; box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 32px 64px rgba(0,0,0,0.4);
        }
        .glass-card h2 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem; color: rgba(255,255,255,0.9); }
        .card-sub { font-size: 0.82rem; color: rgba(255,255,255,0.35); margin: 0 0 1.25rem; }

        /* Resume section */
        .resume-section { margin-bottom: 1.25rem; }
        .resume-header { margin-bottom: 10px; }
        .resume-title { font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.8); display: flex; align-items: center; gap: 6px; }
        .optional-tag { font-size: 0.62rem; background: rgba(255,255,255,0.08); padding: 1px 7px; border-radius: 999px; color: rgba(255,255,255,0.3); font-weight: 400; }
        .resume-sub { font-size: 0.75rem; color: rgba(255,255,255,0.3); margin-top: 3px; }
        .resume-upload-btn {
          width: 100%; padding: 10px 14px; border: 1.5px dashed rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.4);
          border-radius: 10px; cursor: pointer; font-size: 0.82rem;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s;
        }
        .resume-upload-btn:hover { border-color: rgba(168,85,247,0.4); color: rgba(255,255,255,0.65); background: rgba(168,85,247,0.05); }
        .upload-icon { font-size: 0.85rem; }
        .resume-status-box {
          display: flex; align-items: center; padding: 8px 12px;
          border-radius: 10px; border: 1px solid;
          transition: all 0.3s;
        }
        .resume-status-box.parsing { border-color: rgba(250,204,21,0.3); background: rgba(250,204,21,0.05); }
        .resume-status-box.ready   { border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.05); }
        .resume-status-box.error   { border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.05); }
        .resume-file-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .file-icon { font-size: 0.85rem; flex-shrink: 0; }
        .file-name { font-size: 0.8rem; color: rgba(255,255,255,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-status { font-size: 0.7rem; color: rgba(255,255,255,0.35); flex-shrink: 0; }
        .remove-btn { background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 0.8rem; padding: 2px 4px; flex-shrink: 0; }
        .remove-btn:hover { color: rgba(255,255,255,0.7); }

        .section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 1.25rem 0; }

        .diff-grid { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
        .diff-card {
          display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto;
          gap: 2px 10px; align-items: center; padding: 0.9rem 1rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; cursor: pointer; text-align: left; color: #fff; transition: all 0.2s;
        }
        .diff-card:disabled { opacity: 0.5; cursor: not-allowed; }
        .diff-top { display: flex; align-items: center; gap: 7px; grid-column: 1; grid-row: 1; }
        .diff-icon { font-size: 0.9rem; }
        .diff-label { font-weight: 700; font-size: 0.95rem; color: rgba(255,255,255,0.85); }
        .diff-duration { grid-column: 2; grid-row: 1; font-size: 0.75rem; color: rgba(255,255,255,0.3); text-align: right; }
        .diff-desc { grid-column: 1 / -1; grid-row: 2; font-size: 0.78rem; color: rgba(255,255,255,0.3); }
        .diff-check { grid-column: 1 / -1; grid-row: 3; font-size: 0.75rem; font-weight: 600; margin-top: 3px; }

        .error-box { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: #fca5a5; padding: 0.7rem 0.9rem; border-radius: 10px; font-size: 0.82rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .error-dismiss { background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 0.82rem; opacity: 0.6; padding: 0; }

        .start-btn {
          width: 100%; padding: 0.95rem; font-size: 0.98rem; font-weight: 700;
          border: none; border-radius: 12px; cursor: pointer;
          background: linear-gradient(135deg,#7c3aed,#a855f7,#ec4899);
          color: #fff; transition: all 0.25s;
        }
        .start-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(168,85,247,0.35); }
        .start-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .btn-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

        .history-hint { margin: 0.9rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.3); text-align: center; }
        .history-hint a { color: #a855f7; text-decoration: none; font-weight: 500; }

        /* What to expect */
        .expect-section { width: 100%; }
        .expect-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.25); margin: 0 0 12px; text-align: center; font-weight: 500; }
        .expect-grid { display: flex; gap: 10px; }
        .expect-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .expect-icon { font-size: 1.1rem; }
        .expect-label { font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.75); }
        .expect-desc { font-size: 0.68rem; color: rgba(255,255,255,0.25); text-align: center; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) { h1 { font-size: 2rem; } .glass-card { padding: 1.25rem; } }
      `}</style>
    </div>
  );
}