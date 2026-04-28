import { useUser } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import dynamic from 'next/dynamic';

const PerformanceLine = dynamic(() => import('../components/charts/PerformanceLine'), { ssr: false });
const ScoreRadar = dynamic(() => import('../components/charts/ScoreRadar'), { ssr: false });

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const DOMAIN_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  dsa:            { label: 'DSA',           icon: '🧮', color: '#a855f7' },
  frontend:       { label: 'Frontend',      icon: '🎨', color: '#3b82f6' },
  backend:        { label: 'Backend',       icon: '⚙️', color: '#10b981' },
  fullstack:      { label: 'Full Stack',    icon: '🔗', color: '#f59e0b' },
  system_design:  { label: 'Sys Design',    icon: '🏗️', color: '#ef4444' },
  hr_behavioral:  { label: 'HR',            icon: '🤝', color: '#ec4899' },
};

interface StatsData {
  total: number;
  avgScore: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  domainBreakdown: Record<string, { count: number; avgScore: number }>;
  avgBreakdown: { communication: number; technical_knowledge: number; problem_solving: number } | null;
  recentInterviews: { sessionId: string; date: string; score: number; verdict: string; domain: string; feedback: string }[];
  scoreOverTime: { date: string; score: number; domain: string }[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(() => {
    if (!user) return;
    setLoading(true); setError('');
    axios.get(`${apiUrl}/api/user/${user.id}/stats`)
      .then((res) => { setStats(res.data); setLoading(false); })
      .catch((err) => { console.error('Stats error:', err); setError('Could not load stats.'); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push('/sign-in'); return; }
    fetchStats();
  }, [isLoaded, user, fetchStats, router]);

  if (!isLoaded || loading) {
    return (
      <div className="center">
        <div className="spinner" />
        <p>Loading dashboard...</p>
        <style jsx>{`
          .center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: #fff; gap: 1rem; font-family: sans-serif; }
          .spinner { width: 40px; height: 40px; border: 4px solid #222; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.9s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#fff', gap: '16px', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <p style={{ color: '#f87171', margin: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchStats} style={{ background: '#a855f7', color: 'white', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Retry</button>
          <Link href="/" style={{ background: '#222', color: '#ccc', padding: '10px 24px', borderRadius: '8px', border: '1px solid #444', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Home</Link>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const chartData = stats.scoreOverTime.map(i => ({ date: i.date, score: i.score }));

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>Dashboard</h1>
          <p className="welcome">Welcome back, {user?.firstName || 'Interviewer'}</p>
        </div>
        <div className="header-links">
          <Link href="/select" className="btn-primary-sm">+ New Interview</Link>
          <Link href="/history" className="btn-ghost">History</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </header>

      {stats.total === 0 ? (
        <div className="empty">
          <div style={{ fontSize: '4rem' }}>🚀</div>
          <h2>No interviews yet</h2>
          <p>Complete your first AI interview to see your stats here.</p>
          <Link href="/select" className="btn-primary">Start Your First Interview</Link>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-val">{stats.total}</span>
              <span className="stat-label">Interviews</span>
            </div>
            <div className="stat-card">
              <span className="stat-val" style={{ color: getScoreColor(stats.avgScore) }}>{stats.avgScore}</span>
              <span className="stat-label">Avg Score</span>
            </div>
            <div className="stat-card">
              <span className="stat-val" style={{ color: '#4ade80' }}>{stats.bestScore}</span>
              <span className="stat-label">Best Score</span>
            </div>
            <div className="stat-card streak-card">
              <span className="stat-val">{stats.currentStreak}<span className="fire">🔥</span></span>
              <span className="stat-label">Day Streak</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            {chartData.length >= 2 && (
              <div className="chart-card wide">
                <h2>Performance Over Time</h2>
                <PerformanceLine data={chartData} />
              </div>
            )}
            {stats.avgBreakdown && (
              <div className="chart-card narrow">
                <h2>Skill Radar</h2>
                <ScoreRadar
                  communication={stats.avgBreakdown.communication}
                  technical_knowledge={stats.avgBreakdown.technical_knowledge}
                  problem_solving={stats.avgBreakdown.problem_solving}
                />
              </div>
            )}
          </div>

          {/* Domain Breakdown */}
          {Object.keys(stats.domainBreakdown).length > 0 && (
            <section className="section">
              <h2 className="section-title">Domain Performance</h2>
              <div className="domain-grid">
                {Object.entries(stats.domainBreakdown).map(([key, val]) => {
                  const info = DOMAIN_LABELS[key] || DOMAIN_LABELS.dsa;
                  return (
                    <div key={key} className="domain-card" style={{ borderColor: info.color + '30' }}>
                      <div className="domain-icon" style={{ background: info.color + '18', color: info.color }}>{info.icon}</div>
                      <div className="domain-info">
                        <span className="domain-name">{info.label}</span>
                        <span className="domain-count">{val.count} interview{val.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="domain-score" style={{ color: getScoreColor(val.avgScore) }}>{val.avgScore}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent Interviews */}
          {stats.recentInterviews.length > 0 && (
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Recent Interviews</h2>
                <Link href="/history" className="see-all">See all →</Link>
              </div>
              <div className="recent-list">
                {stats.recentInterviews.map((item) => {
                  const info = DOMAIN_LABELS[item.domain] || DOMAIN_LABELS.dsa;
                  return (
                    <Link key={item.sessionId} href={`/report/${item.sessionId}`} className="recent-card">
                      <div className="recent-score" style={{ borderColor: getScoreColor(item.score), color: getScoreColor(item.score) }}>
                        {item.score}
                      </div>
                      <div className="recent-body">
                        <div className="recent-meta">
                          <span className="recent-domain" style={{ color: info.color }}>{info.icon} {info.label}</span>
                          <span className="recent-date">{formatDate(item.date)}</span>
                        </div>
                        <p className="recent-feedback">{item.feedback}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Longest Streak */}
          {stats.longestStreak > 1 && (
            <div className="streak-banner">
              🔥 Longest streak: <strong>{stats.longestStreak} days</strong> — Keep it up!
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168,85,247,0.06), transparent), #0a0a0a;
          color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 2rem; max-width: 1000px; margin: 0 auto;
          animation: fadeIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 12px; }
        .header-left { display: flex; flex-direction: column; gap: 4px; }
        h1 { font-size: 2rem; font-weight: 700; background: linear-gradient(to right, #a855f7, #ec4899); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: -0.03em; }
        .welcome { color: rgba(255,255,255,0.35); font-size: 0.9rem; margin: 0; }
        .header-links { display: flex; gap: 8px; align-items: center; }
        .btn-ghost { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; padding: 0.4rem 0.9rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; transition: all 0.3s; white-space: nowrap; }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-primary-sm { background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; text-decoration: none; font-size: 0.85rem; font-weight: 600; padding: 0.5rem 1.1rem; border-radius: 10px; transition: all 0.3s; white-space: nowrap; }
        .btn-primary-sm:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(168,85,247,0.3); }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; min-height: 50vh; text-align: center; }
        .empty h2 { margin: 0; font-size: 1.5rem; color: rgba(255,255,255,0.7); }
        .empty p { margin: 0; color: rgba(255,255,255,0.35); font-size: 0.95rem; }
        .btn-primary { background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; padding: 0.9rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: all 0.3s; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(168,85,247,0.3); }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 2rem; }
        .stat-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.25rem; text-align: center; display: flex; flex-direction: column; gap: 4px; }
        .stat-val { font-size: 1.8rem; font-weight: 800; }
        .stat-label { font-size: 0.7rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; }
        .fire { font-size: 1.2rem; margin-left: 2px; }
        .streak-card { border-color: rgba(250,204,21,0.2); }

        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 2rem; }
        .chart-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 1.5rem; }
        .chart-card.wide { grid-column: span 1; }
        .chart-card.narrow { grid-column: span 1; }
        .chart-card h2 { font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.5); margin: 0 0 1rem; }

        .section { margin-bottom: 2rem; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .section-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.7); margin: 0 0 1rem; }
        .section-header .section-title { margin-bottom: 0; }
        .see-all { color: #a855f7; text-decoration: none; font-size: 0.85rem; }
        .see-all:hover { text-decoration: underline; }

        .domain-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .domain-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem; display: flex; align-items: center; gap: 12px; transition: all 0.3s; }
        .domain-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .domain-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
        .domain-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .domain-name { font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.8); }
        .domain-count { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
        .domain-score { font-size: 1.4rem; font-weight: 800; flex-shrink: 0; }

        .recent-list { display: flex; flex-direction: column; gap: 10px; }
        .recent-card { display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem 1.25rem; text-decoration: none; color: inherit; transition: all 0.3s; }
        .recent-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
        .recent-score { width: 48px; height: 48px; border-radius: 50%; border: 2px solid; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 800; flex-shrink: 0; background: rgba(0,0,0,0.3); }
        .recent-body { flex: 1; min-width: 0; }
        .recent-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .recent-domain { font-size: 0.78rem; font-weight: 600; }
        .recent-date { font-size: 0.75rem; color: rgba(255,255,255,0.25); }
        .recent-feedback { color: rgba(255,255,255,0.4); font-size: 0.82rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .streak-banner { text-align: center; background: rgba(250,204,21,0.06); border: 1px solid rgba(250,204,21,0.15); border-radius: 12px; padding: 1rem; color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 2rem; }

        @media (max-width: 700px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .charts-row { grid-template-columns: 1fr; }
          .header { flex-direction: column; align-items: flex-start; }
          .domain-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
