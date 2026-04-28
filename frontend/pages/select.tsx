import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

type Difficulty = 'easy' | 'medium' | 'hard';
type Domain = 'dsa' | 'frontend' | 'backend' | 'fullstack' | 'system_design' | 'hr_behavioral';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface DomainConfig {
  label: string; icon: string; desc: string; color: string; glow: string;
}

const DOMAIN_CONFIG: Record<Domain, DomainConfig> = {
  dsa:            { label: 'DSA',             icon: '🧮', desc: 'Arrays, trees, graphs, dynamic programming',             color: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
  frontend:       { label: 'Frontend',        icon: '🎨', desc: 'React, CSS, DOM, browser APIs, performance',             color: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
  backend:        { label: 'Backend',         icon: '⚙️', desc: 'Node.js, APIs, databases, auth, caching',                color: '#10b981', glow: 'rgba(16,185,129,0.15)' },
  fullstack:      { label: 'Full Stack',      icon: '🔗', desc: 'End-to-end: frontend + backend + deployment',            color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  system_design:  { label: 'System Design',   icon: '🏗️', desc: 'Scalability, architecture, trade-offs (verbal only)',     color: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
  hr_behavioral:  { label: 'HR / Behavioral', icon: '🤝', desc: 'Leadership, teamwork, STAR method (verbal only)',        color: '#ec4899', glow: 'rgba(236,72,153,0.15)' },
};

interface DifficultyConfig {
  label: string; duration: string; color: string; glow: string; desc: string; icon: string;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: 'Easy',   duration: '15 min', color: '#4ade80', glow: 'rgba(74,222,128,0.15)',  desc: 'Fundamentals & basics',       icon: '🟢' },
  medium: { label: 'Medium', duration: '30 min', color: '#facc15', glow: 'rgba(250,204,21,0.15)',  desc: 'Intermediate concepts',        icon: '🟡' },
  hard:   { label: 'Hard',   duration: '45 min', color: '#f87171', glow: 'rgba(248,113,113,0.15)', desc: 'Advanced & system-level',      icon: '🔴' },
};

const VERBAL_ONLY: Domain[] = ['system_design', 'hr_behavioral'];

async function extractResumeText(file: File): Promise<string> {
  if (file.type === 'text/plain') {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target?.result as string) || '');
      reader.readAsText(file);
    });
  }
  try {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await axios.post(`${apiUrl}/api/interview/parse-resume`, formData);
    return res.data.text || '';
  } catch { /* fall through */ }
  return `Resume file: ${file.name}`;
}

export default function SelectPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'parsing' | 'ready' | 'error'>('idle');
  const [resumeName, setResumeName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    axios.get(`${apiUrl}/api/user/${user.id}/stats`)
      .then(res => setStreak(res.data.currentStreak || 0))
      .catch(() => {});
  }, [user]);

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    setResumeName('');
    setResumeStatus('idle');
    if (typeof window !== 'undefined') sessionStorage.removeItem('resumeContext');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStart = async () => {
    if (!selectedDomain || !selectedDifficulty) return;
    if (!user) { router.push('/sign-in'); return; }
    setLoading(true); setErrorMsg('');
    try {
      const response = await axios.post(`${apiUrl}/api/interview/create`, {
        domain: selectedDomain,
        difficulty: selectedDifficulty,
        userId: user.id,
      });
      router.push(`/interview/${response.data.sessionId}`);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Failed to connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#050508', color: '#fff' }}>
        <div className="spinner" />
        <style jsx>{`.spinner { width: 40px; height: 40px; border: 4px solid #222; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  const isVerbalOnly = selectedDomain ? VERBAL_ONLY.includes(selectedDomain) : false;
  const canStart = selectedDomain && selectedDifficulty && !loading;

  return (
    <div className="root">
      <div className="orb orb1" /><div className="orb orb2" />

      <nav className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-brand"><span className="brand-icon">⚡</span>AI Interviewer</Link>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
            <Link href="/history" className="nav-link">History</Link>
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="header-section">
          <h1>Configure Your Interview</h1>
          <p className="subtitle">Select a domain and difficulty level to begin your practice session</p>
          {streak > 0 && <div className="streak-badge">🔥 {streak} day streak</div>}
        </div>

        {/* Step 1: Domain Selection */}
        <section className="step-section">
          <h2 className="step-title"><span className="step-num">1</span> Choose Domain</h2>
          <div className="domain-grid">
            {(Object.entries(DOMAIN_CONFIG) as [Domain, DomainConfig][]).map(([key, cfg]) => (
              <button
                key={key}
                className={`domain-card ${selectedDomain === key ? 'selected' : ''}`}
                onClick={() => setSelectedDomain(key)}
                style={{
                  borderColor: selectedDomain === key ? cfg.color : 'rgba(255,255,255,0.08)',
                  background: selectedDomain === key ? cfg.glow : 'rgba(255,255,255,0.03)',
                }}
              >
                <span className="domain-icon">{cfg.icon}</span>
                <span className="domain-label">{cfg.label}</span>
                <span className="domain-desc">{cfg.desc}</span>
                {VERBAL_ONLY.includes(key) && (
                  <span className="verbal-badge">Verbal Only</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Difficulty Selection */}
        <section className="step-section">
          <h2 className="step-title"><span className="step-num">2</span> Choose Difficulty</h2>
          <div className="diff-grid">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, DifficultyConfig][]).map(([key, cfg]) => (
              <button
                key={key}
                className={`diff-card ${selectedDifficulty === key ? 'selected' : ''}`}
                onClick={() => setSelectedDifficulty(key)}
                style={{
                  borderColor: selectedDifficulty === key ? cfg.color : 'rgba(255,255,255,0.08)',
                  background: selectedDifficulty === key ? cfg.glow : 'rgba(255,255,255,0.03)',
                }}
              >
                <span className="diff-icon">{cfg.icon}</span>
                <div className="diff-info">
                  <span className="diff-label">{cfg.label}</span>
                  <span className="diff-duration">{cfg.duration}</span>
                </div>
                <span className="diff-desc">{cfg.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Step 3: Resume (optional) */}
        <section className="step-section">
          <h2 className="step-title"><span className="step-num">3</span> Upload Resume <span className="optional">(optional)</span></h2>
          <div className="resume-area">
            {resumeStatus === 'idle' ? (
              <label className="resume-upload">
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleResumeChange} hidden />
                <span className="upload-icon">📄</span>
                <span>Drop your resume or click to upload</span>
                <span className="upload-hint">PDF, DOCX, or TXT — used to personalize questions</span>
              </label>
            ) : resumeStatus === 'parsing' ? (
              <div className="resume-status">
                <div className="spinner-sm" /> Parsing {resumeName}...
              </div>
            ) : resumeStatus === 'ready' ? (
              <div className="resume-status ready">
                <span>✅ {resumeName}</span>
                <button className="remove-btn" onClick={handleRemoveResume}>Remove</button>
              </div>
            ) : (
              <div className="resume-status error">
                <span>❌ Failed to parse resume</span>
                <button className="remove-btn" onClick={handleRemoveResume}>Try again</button>
              </div>
            )}
          </div>
        </section>

        {/* Summary & Start */}
        <section className="start-section">
          {selectedDomain && selectedDifficulty && (
            <div className="summary">
              <span className="summary-item">{DOMAIN_CONFIG[selectedDomain].icon} {DOMAIN_CONFIG[selectedDomain].label}</span>
              <span className="summary-sep">·</span>
              <span className="summary-item">{DIFFICULTY_CONFIG[selectedDifficulty].icon} {DIFFICULTY_CONFIG[selectedDifficulty].label}</span>
              <span className="summary-sep">·</span>
              <span className="summary-item">{DIFFICULTY_CONFIG[selectedDifficulty].duration}</span>
              {isVerbalOnly && <span className="summary-badge">Verbal Only</span>}
            </div>
          )}
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
          <button
            className="start-btn"
            disabled={!canStart}
            onClick={handleStart}
          >
            {loading ? 'Creating Session...' : `Start ${selectedDomain ? DOMAIN_CONFIG[selectedDomain].label : ''} Interview →`}
          </button>
        </section>
      </main>

      <style jsx>{`
        .root {
          min-height: 100vh;
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(168,85,247,0.08), transparent), #050508;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.4;
          pointer-events: none;
          will-change: transform;
        }
        .orb1 { width: 500px; height: 500px; background: rgba(168,85,247,0.15); top: -10%; right: -5%; animation: drift 25s ease-in-out infinite alternate; }
        .orb2 { width: 400px; height: 400px; background: rgba(236,72,153,0.1); bottom: -10%; left: -5%; animation: drift 30s ease-in-out infinite alternate-reverse; }
        @keyframes drift { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(40px,30px) scale(1.1); } }

        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(5,5,8,0.8);
          backdrop-filter: blur(16px) saturate(1.3);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 2rem;
        }
        .nav-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .nav-brand { font-weight: 700; font-size: 1.15rem; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 6px; }
        .brand-icon { font-size: 1.3rem; }
        .nav-links { display: flex; align-items: center; gap: 1rem; }
        .nav-link { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.88rem; transition: color 0.2s; }
        .nav-link:hover { color: #fff; }

        .main { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

        .header-section { text-align: center; margin-bottom: 3rem; animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        h1 {
          font-size: 2.4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          margin: 0 0 0.5rem; letter-spacing: -0.03em;
        }
        .subtitle { color: rgba(255,255,255,0.4); font-size: 1rem; margin: 0; }
        .streak-badge { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 4px 14px; background: rgba(250,204,21,0.08); border: 1px solid rgba(250,204,21,0.2); border-radius: 999px; font-size: 0.82rem; color: #facc15; font-weight: 600; }

        .step-section { margin-bottom: 2.5rem; animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .step-section:nth-child(2) { animation-delay: 0.1s; }
        .step-section:nth-child(3) { animation-delay: 0.2s; }
        .step-section:nth-child(4) { animation-delay: 0.3s; }
        .step-title { font-size: 1.1rem; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0 0 1rem; display: flex; align-items: center; gap: 0.75rem; }
        .step-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff;
          font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
        }
        .optional { color: rgba(255,255,255,0.3); font-weight: 400; font-size: 0.85rem; }

        .domain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .domain-card {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          text-align: left;
          display: flex; flex-direction: column; gap: 6px;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          backdrop-filter: blur(8px);
          position: relative;
        }
        .domain-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }
        .domain-card.selected { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .domain-icon { font-size: 1.6rem; }
        .domain-label { font-weight: 700; font-size: 0.95rem; color: #fff; }
        .domain-desc { font-size: 0.75rem; color: rgba(255,255,255,0.4); line-height: 1.4; }
        .verbal-badge {
          position: absolute; top: 10px; right: 10px;
          font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
          background: rgba(236,72,153,0.15); color: #ec4899;
          padding: 3px 8px; border-radius: 999px;
        }

        .diff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .diff-card {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          text-align: left;
          display: flex; flex-direction: column; gap: 8px;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          backdrop-filter: blur(8px);
        }
        .diff-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }
        .diff-card.selected { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .diff-icon { font-size: 1.3rem; }
        .diff-info { display: flex; align-items: center; gap: 8px; }
        .diff-label { font-weight: 700; font-size: 0.95rem; color: #fff; }
        .diff-duration { font-size: 0.75rem; color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px; }
        .diff-desc { font-size: 0.75rem; color: rgba(255,255,255,0.4); }

        .resume-area { max-width: 500px; }
        .resume-upload {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 1.5rem;
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 16px;
          cursor: pointer;
          color: rgba(255,255,255,0.4);
          font-size: 0.88rem;
          transition: all 0.3s;
          text-align: center;
        }
        .resume-upload:hover { border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.03); }
        .upload-icon { font-size: 1.5rem; }
        .upload-hint { font-size: 0.72rem; color: rgba(255,255,255,0.25); }
        .resume-status { display: flex; align-items: center; gap: 10px; padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); font-size: 0.88rem; color: rgba(255,255,255,0.5); }
        .resume-status.ready { border-color: rgba(74,222,128,0.2); }
        .resume-status.error { border-color: rgba(248,113,113,0.2); color: #f87171; }
        .remove-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.8rem; text-decoration: underline; }
        .remove-btn:hover { color: #fff; }
        .spinner-sm { width: 16px; height: 16px; border: 2px solid #333; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.9s linear infinite; }

        .start-section { text-align: center; margin-top: 2rem; animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.4s both; }
        .summary {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.04); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 999px;
          padding: 8px 20px; margin-bottom: 1.5rem;
          font-size: 0.85rem; color: rgba(255,255,255,0.6);
        }
        .summary-item { white-space: nowrap; }
        .summary-sep { color: rgba(255,255,255,0.2); }
        .summary-badge {
          font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
          background: rgba(236,72,153,0.15); color: #ec4899;
          padding: 2px 8px; border-radius: 999px;
        }
        .error-msg { color: #f87171; font-size: 0.88rem; margin: 0 0 1rem; }
        .start-btn {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          background-size: 200% auto;
          color: #fff;
          border: none;
          padding: 1rem 3rem;
          border-radius: 14px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          position: relative;
          overflow: hidden;
        }
        .start-btn:hover:not(:disabled) { background-position: right center; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(168,85,247,0.3); }
        .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .start-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.5s;
        }
        .start-btn:hover:not(:disabled)::before { left: 100%; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 700px) {
          .domain-grid { grid-template-columns: repeat(2, 1fr); }
          .diff-grid { grid-template-columns: 1fr; }
          h1 { font-size: 1.8rem; }
        }
        @media (max-width: 480px) {
          .domain-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
