import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
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

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [interviews, setInterviews] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push('/sign-in');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    axios
      .get(`${apiUrl}/api/interview/history/${user.id}`)
      .then((res) => {
        setInterviews(res.data.interviews || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('History error:', err);
        setError('Could not load history. Make sure the backend is running and MongoDB is connected.');
        setLoading(false);
      });
  }, [isLoaded, user, router]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 50) return '#facc15';
    return '#f87171';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Loading ──
  if (!isLoaded || loading) {
    return (
      <div className="center">
        <div className="spinner" />
        <p>Loading history…</p>
        <style jsx>{`
          .center { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#000; color:#fff; gap:1rem; }
          .spinner { width:40px; height:40px; border:4px solid #333; border-top-color:#a855f7; border-radius:50%; animation:spin 1s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="center">
        <p style={{ color: '#f87171' }}>{error}</p>
        <Link href="/" className="btn">← Back to Home</Link>
        <style jsx>{`.center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#000;color:#fff;gap:1rem;} .btn{background:#333;color:#fff;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;}`}</style>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <h1>Interview History</h1>
        <div className="header-links">
          <Link href="/" className="btn-ghost">← Home</Link>
        </div>
      </header>

      {interviews.length === 0 ? (
        <div className="empty">
          <p>No interviews completed yet.</p>
          <Link href="/" className="btn-primary">Start Your First Interview 🚀</Link>
        </div>
      ) : (
        <ul className="list">
          {interviews.map((item) => (
            <li key={item.sessionId} className="card">
              <div className="card-left">
                <div className="score-badge" style={{ borderColor: getScoreColor(item.score), color: getScoreColor(item.score) }}>
                  {item.score}
                </div>
              </div>
              <div className="card-body">
                <div className="card-meta">
                  <span className="verdict" style={{ background: getScoreColor(item.score) + '20', color: getScoreColor(item.score) }}>
                    {item.verdict || (item.score >= 70 ? 'Passed' : 'Needs Improvement')}
                  </span>
                  <span className="date">{formatDate(item.date)}</span>
                </div>
                <p className="feedback">{item.feedback}</p>
              </div>
              <div className="card-right">
                <Link href={`/report/${item.sessionId}`} className="view-btn">
                  View Report →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
          padding: 2rem;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 3rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        h1 {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(to right, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .btn-ghost {
          color: #aaa;
          text-decoration: none;
          font-size: 0.95rem;
          padding: .5rem 1rem;
          border: 1px solid #333;
          border-radius: 8px;
          transition: border-color .2s;
        }
        .btn-ghost:hover { border-color: #666; color: #fff; }
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          min-height: 50vh;
          color: #666;
        }
        .btn-primary {
          background: #a855f7;
          color: #fff;
          padding: 1rem 2rem;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1rem;
        }
        .list {
          list-style: none;
          padding: 0;
          margin: 0;
          max-width: 900px;
          margin-inline: auto;
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
          transition: border-color .2s;
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
        .card-body { flex: 1; min-width: 0; }
        .card-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: .6rem;
          flex-wrap: wrap;
        }
        .verdict {
          padding: .25rem .75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .date { font-size: 0.85rem; color: #666; }
        .feedback {
          color: #aaa;
          font-size: 0.9rem;
          line-height: 1.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .view-btn {
          color: #a855f7;
          text-decoration: none;
          font-size: 0.9rem;
          white-space: nowrap;
          padding: .5rem 1rem;
          border: 1px solid #a855f7;
          border-radius: 8px;
          transition: background .2s;
        }
        .view-btn:hover { background: #a855f720; }
      `}</style>
    </div>
  );
}
