import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';

// --- TYPES ---
interface EvaluationResult {
  score: number;
  feedback: string;
  verdict?: string;
  improvements?: string[];
  strengths?: string[];
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// --- SCORE HELPERS ---
function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Strong Pass';
  if (score >= 60) return 'Pass';
  if (score >= 40) return 'Borderline';
  return 'Needs Work';
}

// --- ANIMATED SCORE RING ---
interface ScoreRingProps {
  score: number;
  color: string;
}
function ScoreRing({ score, color }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 168, height: 168 }}>
      <svg width="168" height="168" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="84" cy="84" r={radius} fill="none" stroke="#222" strokeWidth="10" />
        <circle
          cx="84"
          cy="84"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: `drop-shadow(0 0 8px ${color}80)`,
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '2.8rem', fontWeight: 800, color, lineHeight: 1 }}>
          {displayed}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
          Score
        </span>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function ReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const fetchReport = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    axios
      .get(`${apiUrl}/api/interview/report/${sessionId}`)
      .then((response) => {
        setEvaluation(response.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load report:', err);
        setError('Report not found or failed to load.');
        setLoading(false);
      });
  }, [sessionId, retryCount]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="center-screen">
        <div className="loader" />
        <p style={{ color: '#888', marginTop: '16px' }}>Loading your report...</p>
        <style jsx>{`
          .center-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #0a0a0a;
          }
          .loader {
            border: 4px solid #222;
            border-top: 4px solid #a855f7;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            animation: spin 0.9s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0a',
          color: '#fff',
          gap: '16px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ color: '#f87171', margin: 0 }}>{error || 'Report not found'}</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          The report may still be generating. Please try again.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            style={{
              background: '#a855f7',
              color: 'white',
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              background: '#222',
              color: '#ccc',
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid #444',
              cursor: 'pointer',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(evaluation.score);
  const scoreLabel = evaluation.verdict || getScoreLabel(evaluation.score);
  const hasStrengths = evaluation.strengths && evaluation.strengths.length > 0;
  const hasImprovements = evaluation.improvements && evaluation.improvements.length > 0;

  return (
    <div className="report-container">
      <header className="report-header">
        <h1>Interview Report</h1>
        <p className="session-id">
          Session #{typeof sessionId === 'string' ? sessionId.slice(-8).toUpperCase() : ''}
        </p>
      </header>

      <section className="score-section">
        <ScoreRing score={evaluation.score} color={scoreColor} />
        <div
          className="verdict-badge"
          style={{
            background: scoreColor + '18',
            color: scoreColor,
            border: `1px solid ${scoreColor}40`,
          }}
        >
          {scoreLabel}
        </div>
      </section>

      <div className="cards-grid">
        <section className="card">
          <h2>📝 Feedback</h2>
          <p>{evaluation.feedback}</p>
        </section>

        {hasStrengths && (
          <section className="card strengths-card">
            <h2>✅ Strengths</h2>
            <ul className="result-list">
              {evaluation.strengths!.map((item, idx) => (
                <li key={idx} className="strength-item">{item}</li>
              ))}
            </ul>
          </section>
        )}

        {hasImprovements && (
          <section className="card improvements-card">
            <h2>🚀 Areas for Improvement</h2>
            <ul className="result-list">
              {evaluation.improvements!.map((item, idx) => (
                <li key={idx} className="improvement-item">{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="report-actions">
        <Link href="/" className="action-btn secondary-btn">
          ← Back to Dashboard
        </Link>
        <Link href="/history" className="action-btn primary-btn">
          View All Interviews
        </Link>
      </footer>

      <style jsx>{`
        .report-container {
          min-height: 100vh;
          background: #0a0a0a;
          color: white;
          padding: 2rem;
          font-family: sans-serif;
          max-width: 860px;
          margin: 0 auto;
        }
        .report-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }
        h1 {
          font-size: 2.4rem;
          margin: 0 0 8px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .session-id {
          color: #444;
          font-size: 0.8rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 0;
        }
        .score-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          margin-bottom: 3rem;
        }
        .verdict-badge {
          padding: 6px 20px;
          border-radius: 24px;
          font-weight: bold;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .cards-grid {
          display: grid;
          gap: 20px;
        }
        .card {
          background: #111;
          padding: 24px;
          border-radius: 14px;
          border: 1px solid #222;
          transition: border-color 0.2s;
        }
        .card:hover {
          border-color: #333;
        }
        .strengths-card {
          border-color: #14532d44;
        }
        .strengths-card:hover {
          border-color: #4ade8040;
        }
        .improvements-card {
          border-color: #78350f44;
        }
        .improvements-card:hover {
          border-color: #facc1540;
        }
        h2 {
          color: #e0e0e0;
          margin: 0 0 16px;
          font-size: 1.05rem;
          padding-bottom: 12px;
          border-bottom: 1px solid #1e1e1e;
        }
        p {
          color: #999;
          line-height: 1.7;
          margin: 0;
          font-size: 0.95rem;
        }
        .result-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .result-list li {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .strength-item {
          background: #052e16;
          color: #86efac;
          border: 1px solid #14532d33;
        }
        .improvement-item {
          background: #1c1400;
          color: #fde68a;
          border: 1px solid #78350f33;
        }
        .report-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 3rem;
          padding-bottom: 2rem;
          flex-wrap: wrap;
        }
        .action-btn {
          display: inline-block;
          padding: 12px 28px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          transition: opacity 0.2s, transform 0.15s;
        }
        .action-btn:hover {
          opacity: 0.88;
          transform: translateY(-1px);
        }
        .secondary-btn {
          background: #1a1a1a;
          color: #ccc;
          border: 1px solid #333;
        }
        .primary-btn {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: white;
          border: none;
        }
      `}</style>
    </div>
  );
}