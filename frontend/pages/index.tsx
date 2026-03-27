import { useUser, SignOutButton } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

type Difficulty = 'easy' | 'medium' | 'hard';

interface CreateInterviewResponse {
  sessionId: string;
  question: {
    title: string;
    description: string;
    testCases?: { input: string; output: string }[];
  };
}

type DifficultyConfig = {
  label: string;
  duration: string;
  color: string;
  glow: string;
  desc: string;
  icon: string;
};

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: 'Easy',   duration: '15 min', color: '#4ade80', glow: 'rgba(74,222,128,0.15)',  desc: 'Arrays, strings, basic logic',   icon: '🟢' },
  medium: { label: 'Medium', duration: '30 min', color: '#facc15', glow: 'rgba(250,204,21,0.15)',  desc: 'Trees, sorting, two pointers',   icon: '🟡' },
  hard:   { label: 'Hard',   duration: '45 min', color: '#f87171', glow: 'rgba(248,113,113,0.15)', desc: 'DP, graphs, advanced algorithms', icon: '🔴' },
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStartInterview = async () => {
    if (!selectedDifficulty) return;
    if (!user) { router.push('/sign-in'); return; }

    setLoading(true);
    setErrorMsg('');
    try {
      const response = await axios.post<CreateInterviewResponse>(
        `${apiUrl}/api/interview/create`,
        { difficulty: selectedDifficulty, userId: user.id }
      );
      router.push(`/interview/${response.data.sessionId}`);
    } catch (error: any) {
      setErrorMsg(
        error.response?.data?.error || 'Failed to connect to server. Is the backend running?'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="root">
      {/* Animated background orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-inner">
          <span className="nav-brand">
            <span className="brand-icon">⚡</span>
            AI Interviewer
          </span>
          <div className="nav-links">
            {isLoaded && user ? (
              <>
                <Link href="/history" className="nav-link">📋 History</Link>
                <span className="nav-user">
                  {user.firstName || user.emailAddresses[0]?.emailAddress}
                </span>
                <SignOutButton>
                  <button className="nav-btn">Sign Out</button>
                </SignOutButton>
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

      {/* Hero */}
      <main className="main">
        <div className="hero-text">
          <div className="badge">🤖 AI-Powered Mock Interviews</div>
          <h1>
            Ace Your Next<br />
            <span className="gradient-text">Tech Interview</span>
          </h1>
          <p className="hero-sub">
            {user
              ? `Welcome back, ${user.firstName || 'there'}! Ready to practice?`
              : 'Real DSA problems. Real-time AI feedback. Zero pressure.'}
          </p>
        </div>

        {/* Glass Card */}
        <div className="glass-card">
          <h2>Select Difficulty</h2>
          <p className="card-sub">Choose a level that matches your preparation</p>

          <div className="diff-grid">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, DifficultyConfig][]).map(
              ([level, cfg]) => (
                <button
                  key={level}
                  className={`diff-card ${selectedDifficulty === level ? 'selected' : ''}`}
                  onClick={() => setSelectedDifficulty(level)}
                  disabled={loading}
                  style={
                    selectedDifficulty === level
                      ? {
                          borderColor: cfg.color,
                          boxShadow: `0 0 0 1px ${cfg.color}, 0 8px 32px ${cfg.glow}`,
                          background: `linear-gradient(135deg, ${cfg.glow}, rgba(255,255,255,0.03))`,
                        }
                      : {}
                  }
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
              )
            )}
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
              <span className="btn-inner">
                <span className="spinner" />
                Generating Questions...
              </span>
            ) : !user ? (
              '🔒 Sign In to Start'
            ) : selectedDifficulty ? (
              `Start ${DIFFICULTY_CONFIG[selectedDifficulty].label} Interview 🚀`
            ) : (
              'Select a Difficulty'
            )}
          </button>

          {user && (
            <p className="history-hint">
              <Link href="/history">View past interviews →</Link>
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="stats-row">
          {[
            { val: '3',    label: 'DSA Questions' },
            { val: 'GPT-4o', label: 'AI Model' },
            { val: 'Live', label: 'Voice Interview' },
          ].map((s) => (
            <div key={s.label} className="stat-pill">
              <span className="stat-val">{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        /* ---- Reset & Root ---- */
        .root {
          min-height: 100vh;
          background: #050508;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
        }

        /* ---- Animated background orbs ---- */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          pointer-events: none;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .orb1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #7c3aed, transparent);
          top: -200px; left: -200px;
          animation-delay: 0s;
        }
        .orb2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #2563eb, transparent);
          bottom: -150px; right: -150px;
          animation-delay: 4s;
        }
        .orb3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #db2777, transparent);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: 8s;
        }
        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(30px, -30px) scale(1.05); }
        }

        /* ---- Navbar ---- */
        .navbar {
          width: 100%;
          position: relative;
          z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(5,5,8,0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0.9rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-brand {
          font-weight: 700;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: -0.3px;
        }
        .brand-icon { font-size: 1.1rem; }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .nav-link {
          text-decoration: none;
          color: rgba(255,255,255,0.5);
          font-size: 0.88rem;
          font-weight: 500;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .nav-user {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.35);
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-btn {
          padding: 0.4rem 0.9rem;
          font-size: 0.85rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
        }
        .nav-btn:hover {
          border-color: rgba(255,255,255,0.25);
          color: #fff;
          background: rgba(255,255,255,0.08);
        }
        .nav-btn-primary {
          background: rgba(168,85,247,0.2);
          border-color: rgba(168,85,247,0.4);
          color: #d8b4fe;
        }
        .nav-btn-primary:hover {
          background: rgba(168,85,247,0.3);
          border-color: rgba(168,85,247,0.6);
          color: #fff;
        }

        /* ---- Main layout ---- */
        .main {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem 1.5rem 4rem;
          width: 100%;
          max-width: 560px;
          gap: 2rem;
        }

        /* ---- Hero text ---- */
        .hero-text { text-align: center; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.35rem 0.9rem;
          background: rgba(168,85,247,0.12);
          border: 1px solid rgba(168,85,247,0.25);
          border-radius: 999px;
          font-size: 0.8rem;
          color: #c4b5fd;
          margin-bottom: 1.25rem;
          backdrop-filter: blur(8px);
        }
        h1 {
          font-size: 2.8rem;
          font-weight: 800;
          line-height: 1.15;
          margin: 0 0 1rem;
          letter-spacing: -1px;
        }
        .gradient-text {
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 1rem;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.6;
        }

        /* ---- Glass card ---- */
        .glass-card {
          width: 100%;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 2rem;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 32px 64px rgba(0,0,0,0.4);
        }
        .glass-card h2 {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
          color: rgba(255,255,255,0.9);
        }
        .card-sub {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.35);
          margin: 0 0 1.5rem;
        }

        /* ---- Difficulty cards ---- */
        .diff-grid {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          margin-bottom: 1.5rem;
        }
        .diff-card {
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-rows: auto auto auto;
          gap: 2px 12px;
          align-items: center;
          padding: 1rem 1.1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          color: #fff;
          transition: all 0.22s ease;
          position: relative;
          overflow: hidden;
        }
        .diff-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
          border-radius: inherit;
        }
        .diff-card:hover:not(:disabled)::before {
          background: rgba(255,255,255,0.025);
        }
        .diff-card:disabled { opacity: 0.5; cursor: not-allowed; }
        .diff-top {
          display: flex;
          align-items: center;
          gap: 8px;
          grid-column: 1;
          grid-row: 1;
        }
        .diff-icon { font-size: 0.95rem; }
        .diff-label {
          font-weight: 700;
          font-size: 0.98rem;
          color: rgba(255,255,255,0.85);
          transition: color 0.2s;
        }
        .diff-duration {
          grid-column: 2;
          grid-row: 1;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.3);
          text-align: right;
        }
        .diff-desc {
          grid-column: 1 / -1;
          grid-row: 2;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.35);
          margin-top: 2px;
        }
        .diff-check {
          grid-column: 1 / -1;
          grid-row: 3;
          font-size: 0.78rem;
          font-weight: 600;
          margin-top: 4px;
          letter-spacing: 0.3px;
        }

        /* ---- Error box ---- */
        .error-box {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.25);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .error-dismiss {
          background: none;
          border: none;
          color: #fca5a5;
          cursor: pointer;
          font-size: 0.85rem;
          opacity: 0.6;
          padding: 0;
          flex-shrink: 0;
        }

        /* ---- Start button ---- */
        .start-btn {
          width: 100%;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 700;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899);
          background-size: 200% 200%;
          color: #fff;
          letter-spacing: 0.2px;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }
        .start-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
        }
        .start-btn:hover:not(:disabled)::before { background: rgba(255,255,255,0.08); }
        .start-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(168,85,247,0.35); }
        .start-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }

        /* ---- History hint ---- */
        .history-hint {
          margin: 1rem 0 0;
          font-size: 0.83rem;
          color: rgba(255,255,255,0.3);
          text-align: center;
        }
        .history-hint a {
          color: #a855f7;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        .history-hint a:hover { color: #c084fc; }

        /* ---- Stats row ---- */
        .stats-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .stat-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.6rem 1.2rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          backdrop-filter: blur(8px);
          gap: 2px;
        }
        .stat-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
        }
        .stat-label {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.3);
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          h1 { font-size: 2rem; }
          .glass-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}