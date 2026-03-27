import { useUser } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';

interface HistoryItem {
  sessionId: string;
  date: string;
  score: number;
  feedback: string;
  verdict: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [interviews, setInterviews] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const fetchHistory = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    axios
      .get(`${apiUrl}/api/interview/history/${user.id}`)
      .then((res) => {
        setInterviews(res.data.interviews || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('History error:', err);
        setError('Could not load history. Make sure the backend is running.');
        setLoading(false);
      });
  }, [user, retryCount]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push('/sign-in');
      return;
    }
    fetchHistory();
  }, [isLoaded, user, fetchHistory]);

  // Loading
  if (!isLoaded || loading) {
    return (
      <div className="center">
        <div className="spinner" />
        <p>Loading history…</p>
        <style jsx>{`
          .center {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #0a0a0a;
            color: #fff;
            gap: 1rem;
            font-family: sans-serif;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #222;
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#fff',
          gap: '16px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <p style={{ color: '#f87171', margin: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
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
          <Link
            href="/"
            style={{
              background: '#222',
              color: '#ccc',
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid #444',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Interview History</h1>
        <Link href="/" className="btn-ghost">← Home</Link>
      </header>

      {interviews.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: '4rem' }}>🎯</div>
          <p>No interviews completed yet.</p>
          <Link href="/" className="btn-primary">Start Your First Interview 🚀</Link>
        </div>
      ) : (
        <ul className="list">
          {interviews.map((item) => (
            <li key={item.sessionId} className="card">
              <div className="score-badge" style={{ borderColor: getScoreColor(item.score), color: getScoreColor(item.score) }}>
                {item.score}
              </div>
              <div className="card-body">
                <div className="card-meta">
                  <span
                    className="verdict"
                    style={{
                      background: getScoreColor(item.score) + '20',
                      color: getScoreColor(item.score),
                    }}
                  >
                    {item.verdict || (item.score >= 70 ? 'Passed' : 'Needs Improvement')}
                  </span>
                  <span className="date">{formatDate(item.date)}</span>
                </div>
                <p className="feedback">{item.feedback}</p>
              </div>
              <Link href={`/report/${item.sessionId}`} className="view-btn">
                View Report →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0a0a0a;
          color: #fff;
          font-family: sans-serif;
          padding: 2rem;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 3rem;
          max-width: 900px;
          margin-inline: auto;
          margin-bottom: 2.5rem;
        }
        h1 {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(to right, #a855f7, #ec4899);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .btn-ghost {
          color: #aaa;
          text-decoration: none;
          font-size: 0.9rem;
          padding: 0.5rem 1rem;
          border: 1px solid #333;
          border-radius: 8px;
          transition: border-color 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .btn-ghost:hover { border-color: #666; color: #fff; }
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          min-height: 50vh;
          color: #666;
          text-align: center;
        }
        .empty p { margin: 0; font-size: 1rem; }
        .btn-primary {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: #fff;
          padding: 0.9rem 2rem;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1rem;
          transition: opacity 0.2s;
        }
        .btn-primary:hover { opacity: 0.88; }
        .list {
          list-style: none;
          padding: 0;
          margin: 0 auto;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .card {
          background: #111;
          border: 1px solid #222;
          border-radius: 14px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          transition: border-color 0.2s;
        }
        .card:hover { border-color: #444; }
        .score-badge {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 3px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          font-weight: 800;
          flex-shrink: 0;
        }
        .card-body {
          flex: 1;
          min-width: 0; /* Fix: allows text-overflow to work in flex child */
        }
        .card-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        .verdict {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .date { font-size: 0.82rem; color: #555; }
        .feedback {
          color: #888;
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
          /* Fix: these three properties together make ellipsis work */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .view-btn {
          color: #a855f7;
          text-decoration: none;
          font-size: 0.88rem;
          white-space: nowrap;
          padding: 0.5rem 1rem;
          border: 1px solid #a855f730;
          border-radius: 8px;
          transition: background 0.2s, border-color 0.2s;
          flex-shrink: 0;
        }
        .view-btn:hover {
          background: #a855f718;
          border-color: #a855f7;
        }
        @media (max-width: 600px) {
          .card { flex-wrap: wrap; }
          .view-btn { width: 100%; text-align: center; }
        }
      `}</style>
    </div>
  );
}