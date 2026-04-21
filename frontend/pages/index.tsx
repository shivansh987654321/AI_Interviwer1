import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI-Powered Questions',
    desc: 'Groq-backed LLM generates unique, context-aware DSA and behavioral problems every session.',
    color: '#a855f7',
  },
  {
    icon: '🎤',
    title: 'Voice Interview Mode',
    desc: 'Real-time speech-to-text and text-to-speech so you practice speaking your answers out loud.',
    color: '#3b82f6',
  },
  {
    icon: '⚡',
    title: 'Instant Evaluation',
    desc: 'Submit your code and get a verdict, score, and per-test-case breakdown in under two seconds.',
    color: '#ec4899',
  },
  {
    icon: '📄',
    title: 'Resume-Aware',
    desc: 'Upload your PDF or DOCX resume and the AI tailors questions to your specific experience.',
    color: '#f59e0b',
  },
  {
    icon: '📊',
    title: 'Progress Dashboard',
    desc: 'Track score trends, streaks, domain performance, and skill breakdowns over time.',
    color: '#10b981',
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    desc: 'Clerk-powered authentication with per-user session isolation. Your data stays yours.',
    color: '#ef4444',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Pick your domain & difficulty',
    desc: 'Choose from DSA, Frontend, Backend, System Design, or HR Behavioral. Set easy, medium, or hard.',
  },
  {
    num: '02',
    title: 'Interview with the AI',
    desc: 'The AI asks questions, listens to your voice answers, and presents coding challenges in a live editor.',
  },
  {
    num: '03',
    title: 'Get your report card',
    desc: 'Review your score, per-question feedback, improvements, and track progress on your dashboard.',
  },
];

const DOMAINS = [
  { key: 'dsa',           label: 'DSA',            icon: '🧮', desc: 'Arrays, trees, graphs, DP', color: '#a855f7' },
  { key: 'frontend',      label: 'Frontend',        icon: '🎨', desc: 'React, CSS, web APIs',      color: '#3b82f6' },
  { key: 'backend',       label: 'Backend',         icon: '⚙️', desc: 'APIs, databases, scaling',  color: '#10b981' },
  { key: 'fullstack',     label: 'Full Stack',      icon: '🔗', desc: 'End-to-end architecture',   color: '#f59e0b' },
  { key: 'system_design', label: 'System Design',   icon: '🏗️', desc: 'Scale, reliability, trade-offs', color: '#ef4444' },
  { key: 'hr_behavioral', label: 'HR & Behavioral', icon: '🤝', desc: 'STAR method, culture fit',  color: '#ec4899' },
];

const STATS = [
  { value: '500+', label: 'Test Cases' },
  { value: '6',    label: 'Interview Domains' },
  { value: '3',    label: 'Difficulty Levels' },
  { value: '< 2s', label: 'AI Evaluation' },
];

export default function LandingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleCTA = () => {
    if (isLoaded && user) {
      router.push('/select');
    } else {
      router.push('/sign-up');
    }
  };

  return (
    <div className="root">
      {/* Background orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />
      <div className="grid-overlay" />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            <span className="brand-icon">⚡</span>
            <span>AI Interviewer</span>
          </Link>
          <div className="nav-links">
            {mounted && isLoaded && user ? (
              <>
                <Link href="/dashboard" className="nav-link">Dashboard</Link>
                <Link href="/select" className="nav-btn nav-btn-primary">Start Interview →</Link>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="nav-link">Sign In</Link>
                <Link href="/sign-up" className="nav-btn nav-btn-primary">Get Started Free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-dot" />
            AI-Powered Technical Interviews
          </div>

          <h1 className="hero-h1">
            Prepare Smarter.<br />
            <span className="gradient-text">Interview Fearlessly.</span>
          </h1>

          <p className="hero-p">
            Practice real DSA problems, behavioral questions, and system design with
            an AI that gives you instant feedback — including voice mode so you can
            rehearse speaking your answers.
          </p>

          <div className="hero-actions">
            <button className="cta-btn" onClick={handleCTA}>
              {mounted && isLoaded && user ? 'Start Practicing →' : 'Get Started Free →'}
            </button>
            <Link href="/sign-in" className="cta-ghost">Sign in</Link>
          </div>

          <p className="hero-note">No credit card required · Powered by Groq AI</p>
        </div>

        {/* Mock terminal card */}
        <div className="hero-visual">
          <div className="terminal-card">
            <div className="terminal-bar">
              <span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" />
              <span className="terminal-title">interview.ts</span>
            </div>
            <div className="terminal-body">
              <div className="t-line"><span className="t-kw">function</span> <span className="t-fn">twoSum</span><span className="t-punc">(</span><span className="t-var">nums</span><span className="t-punc">:</span> <span className="t-type">number[]</span><span className="t-punc">,</span> <span className="t-var">target</span><span className="t-punc">:</span> <span className="t-type">number</span><span className="t-punc">)</span> <span className="t-punc">{'{'}</span></div>
              <div className="t-line t-indent"><span className="t-kw">const</span> <span className="t-var">map</span> <span className="t-op">=</span> <span className="t-kw">new</span> <span className="t-fn">Map</span><span className="t-punc">();</span></div>
              <div className="t-line t-indent"><span className="t-kw">for</span> <span className="t-punc">(</span><span className="t-kw">let</span> <span className="t-var">i</span> <span className="t-op">=</span> <span className="t-num">0</span><span className="t-punc">;</span> <span className="t-var">i</span> <span className="t-op">&lt;</span> <span className="t-var">nums</span><span className="t-punc">.</span><span className="t-prop">length</span><span className="t-punc">;</span> <span className="t-var">i</span><span className="t-op">++</span><span className="t-punc">) {'{'}</span></div>
              <div className="t-line t-indent2"><span className="t-kw">const</span> <span className="t-var">comp</span> <span className="t-op">=</span> <span className="t-var">target</span> <span className="t-op">-</span> <span className="t-var">nums</span><span className="t-punc">[</span><span className="t-var">i</span><span className="t-punc">];</span></div>
              <div className="t-line t-indent2"><span className="t-kw">if</span> <span className="t-punc">(</span><span className="t-var">map</span><span className="t-punc">.</span><span className="t-fn">has</span><span className="t-punc">(</span><span className="t-var">comp</span><span className="t-punc">))</span> <span className="t-kw">return</span> <span className="t-punc">[</span><span className="t-var">map</span><span className="t-punc">.</span><span className="t-fn">get</span><span className="t-punc">(</span><span className="t-var">comp</span><span className="t-punc">),</span> <span className="t-var">i</span><span className="t-punc">];</span></div>
              <div className="t-line t-indent2"><span className="t-var">map</span><span className="t-punc">.</span><span className="t-fn">set</span><span className="t-punc">(</span><span className="t-var">nums</span><span className="t-punc">[</span><span className="t-var">i</span><span className="t-punc">],</span> <span className="t-var">i</span><span className="t-punc">);</span></div>
              <div className="t-line t-indent"><span className="t-punc">{'}'}</span></div>
              <div className="t-line"><span className="t-punc">{'}'}</span></div>
              <div className="t-spacer" />
              <div className="t-verdict">
                <span className="verdict-pill">✓ Accepted</span>
                <span className="verdict-score">Score: 92/100</span>
              </div>
            </div>
          </div>
          <div className="voice-pill">
            <span className="voice-ring" />
            <span className="mic-icon">🎤</span>
            <span className="voice-text">Voice mode active</span>
            <span className="voice-wave"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="stats-bar">
        {STATS.map(s => (
          <div key={s.label} className="stat-item">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label">Features</div>
          <h2 className="section-h2">Everything you need to land the job</h2>
          <p className="section-sub">From code execution to voice practice — all in one platform.</p>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{ '--accent': f.color } as React.CSSProperties}>
                <div className="feature-icon-wrap" style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                  <span className="feature-icon">{f.icon}</span>
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section section-alt">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-h2">From sign-up to offer letter</h2>
          <p className="section-sub">Three steps. Real feedback. Zero fluff.</p>
          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <div key={step.num} className="step-card">
                <div className="step-num">{step.num}</div>
                {i < STEPS.length - 1 && <div className="step-connector" />}
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domains ── */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label">Domains</div>
          <h2 className="section-h2">Practice for any role</h2>
          <p className="section-sub">Six interview tracks designed by engineers who've been there.</p>
          <div className="domains-grid">
            {DOMAINS.map(d => (
              <div key={d.key} className="domain-card" style={{ '--accent': d.color } as React.CSSProperties}>
                <div className="domain-icon-wrap">
                  <span className="domain-icon">{d.icon}</span>
                </div>
                <div className="domain-info">
                  <span className="domain-label" style={{ color: d.color }}>{d.label}</span>
                  <span className="domain-desc">{d.desc}</span>
                </div>
                <span className="domain-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-orb" />
        <div className="cta-inner">
          <div className="section-label">Ready?</div>
          <h2 className="cta-h2">Start your first interview<br /><span className="gradient-text">in under 60 seconds</span></h2>
          <p className="cta-p">No setup. No billing. Just click and start practicing.</p>
          <button className="cta-btn cta-btn-large" onClick={handleCTA}>
            {mounted && isLoaded && user ? 'Go to Interview →' : 'Create Free Account →'}
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand"><span className="brand-icon">⚡</span> AI Interviewer</span>
          <span className="footer-copy">Built with Groq · Next.js · Spring Boot · Clerk</span>
        </div>
      </footer>

      <style jsx>{`
        /* ─── Base ─────────────────────────────────────── */
        .root {
          min-height: 100vh;
          background: #050508;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* ─── Background ────────────────────────────────── */
        .orb {
          position: fixed; border-radius: 50%; filter: blur(100px);
          opacity: 0.18; pointer-events: none; z-index: 0;
        }
        .orb1 { width: 700px; height: 700px; background: radial-gradient(circle, #7c3aed, transparent); top: -300px; left: -200px; animation: drift 14s ease-in-out infinite alternate; }
        .orb2 { width: 600px; height: 600px; background: radial-gradient(circle, #2563eb, transparent); bottom: 0; right: -200px; animation: drift 18s ease-in-out infinite alternate-reverse; }
        .orb3 { width: 500px; height: 500px; background: radial-gradient(circle, #db2777, transparent); top: 40%; left: 35%; animation: drift 22s ease-in-out infinite alternate; }
        @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(40px, -40px) scale(1.08); } }

        .grid-overlay {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%);
        }

        /* ─── Navbar ────────────────────────────────────── */
        .navbar {
          position: sticky; top: 0; z-index: 100; width: 100%;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(5,5,8,0.7); backdrop-filter: blur(16px);
        }
        .nav-inner {
          max-width: 1160px; margin: 0 auto; padding: 0 2rem;
          height: 60px; display: flex; align-items: center; justify-content: space-between;
        }
        .nav-brand {
          font-weight: 800; font-size: 1.05rem;
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; color: #fff;
        }
        .brand-icon { font-size: 1.1rem; }
        .nav-links { display: flex; align-items: center; gap: 0.5rem; }
        .nav-link {
          text-decoration: none; color: rgba(255,255,255,0.5); font-size: 0.875rem;
          padding: 0.4rem 0.8rem; border-radius: 8px; transition: color 0.2s, background 0.2s;
        }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .nav-btn {
          padding: 0.45rem 1rem; font-size: 0.85rem; font-weight: 600;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
          cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
          transition: all 0.2s; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04);
        }
        .nav-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.08); }
        .nav-btn-primary {
          background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(236,72,153,0.3));
          border-color: rgba(168,85,247,0.45); color: #d8b4fe;
        }
        .nav-btn-primary:hover { background: linear-gradient(135deg, rgba(124,58,237,0.45), rgba(236,72,153,0.45)); color: #fff; }

        /* ─── Hero ──────────────────────────────────────── */
        .hero {
          position: relative; z-index: 1;
          max-width: 1160px; margin: 0 auto;
          padding: 6rem 2rem 4rem;
          display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center;
        }
        .hero-inner { display: flex; flex-direction: column; gap: 1.25rem; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 0.4rem 1rem; border-radius: 999px;
          background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.25);
          font-size: 0.8rem; color: #c4b5fd; width: fit-content;
        }
        .badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #a855f7; flex-shrink: 0;
          box-shadow: 0 0 8px #a855f7;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(0.85)} }

        .hero-h1 {
          font-size: clamp(2.5rem, 4.5vw, 3.5rem);
          font-weight: 900; line-height: 1.1;
          letter-spacing: -1.5px; margin: 0;
        }
        .gradient-text {
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 55%, #f97316 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hero-p {
          font-size: 1.05rem; color: rgba(255,255,255,0.5);
          line-height: 1.7; margin: 0; max-width: 480px;
        }
        .hero-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .cta-btn {
          padding: 0.8rem 1.75rem; font-size: 0.95rem; font-weight: 700;
          border: none; border-radius: 12px; cursor: pointer;
          background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899);
          color: #fff; transition: all 0.25s;
          box-shadow: 0 4px 20px rgba(168,85,247,0.25);
        }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(168,85,247,0.4); }
        .cta-btn-large { padding: 1rem 2.25rem; font-size: 1.05rem; }
        .cta-ghost {
          padding: 0.8rem 1.25rem; font-size: 0.9rem; font-weight: 500;
          text-decoration: none; color: rgba(255,255,255,0.45);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          transition: all 0.2s;
        }
        .cta-ghost:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.22); }
        .hero-note { font-size: 0.75rem; color: rgba(255,255,255,0.2); margin: 0; }

        /* Terminal mockup */
        .hero-visual { position: relative; display: flex; flex-direction: column; gap: 1rem; }
        .terminal-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;
          backdrop-filter: blur(16px);
        }
        .terminal-bar {
          padding: 0.7rem 1rem; background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 0.4rem;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot-red    { background: #ff5f57; }
        .dot-yellow { background: #febc2e; }
        .dot-green  { background: #28c840; }
        .terminal-title {
          margin-left: auto; font-size: 0.72rem;
          color: rgba(255,255,255,0.25); font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .terminal-body { padding: 1.25rem 1.5rem; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 0.8rem; line-height: 1.75; }
        .t-line { white-space: nowrap; }
        .t-indent  { padding-left: 1.5rem; }
        .t-indent2 { padding-left: 3rem; }
        .t-spacer  { height: 0.75rem; }
        .t-kw   { color: #c792ea; }
        .t-fn   { color: #82aaff; }
        .t-var  { color: #f78c6c; }
        .t-type { color: #c3e88d; }
        .t-punc { color: rgba(255,255,255,0.45); }
        .t-op   { color: #89ddff; }
        .t-num  { color: #f78c6c; }
        .t-prop { color: #82aaff; }
        .t-verdict { display: flex; align-items: center; gap: 0.75rem; }
        .verdict-pill {
          padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700;
          background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.3); color: #4ade80;
        }
        .verdict-score { font-size: 0.75rem; color: rgba(255,255,255,0.35); }

        /* Voice pill */
        .voice-pill {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.6rem 1rem; border-radius: 999px;
          background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25);
          width: fit-content; position: relative;
        }
        .voice-ring {
          position: absolute; inset: -4px; border-radius: 999px;
          border: 1px solid rgba(59,130,246,0.2);
          animation: ring 2s ease-in-out infinite;
        }
        @keyframes ring { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.05);opacity:0} }
        .mic-icon { font-size: 0.9rem; }
        .voice-text { font-size: 0.78rem; color: #93c5fd; }
        .voice-wave { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
        .voice-wave span {
          display: block; width: 3px; border-radius: 2px;
          background: #3b82f6; animation: wave 1s ease-in-out infinite;
        }
        .voice-wave span:nth-child(1) { height: 4px;  animation-delay: 0s; }
        .voice-wave span:nth-child(2) { height: 10px; animation-delay: 0.1s; }
        .voice-wave span:nth-child(3) { height: 14px; animation-delay: 0.2s; }
        .voice-wave span:nth-child(4) { height: 8px;  animation-delay: 0.3s; }
        .voice-wave span:nth-child(5) { height: 5px;  animation-delay: 0.4s; }
        @keyframes wave { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.35)} }

        /* ─── Stats bar ─────────────────────────────────── */
        .stats-bar {
          position: relative; z-index: 1;
          max-width: 1160px; margin: 0 auto 0;
          padding: 0 2rem 4rem;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
        }
        .stat-item {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 1.5rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 16px;
          margin: 0 4px;
        }
        .stat-value {
          font-size: 2rem; font-weight: 900; letter-spacing: -1px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .stat-label { font-size: 0.78rem; color: rgba(255,255,255,0.3); }

        /* ─── Sections ──────────────────────────────────── */
        .section { position: relative; z-index: 1; padding: 5rem 2rem; }
        .section-alt { background: rgba(255,255,255,0.015); }
        .section-inner { max-width: 1160px; margin: 0 auto; }
        .section-label {
          display: inline-block; font-size: 0.72rem; font-weight: 600;
          letter-spacing: 2px; text-transform: uppercase;
          color: #a855f7; margin-bottom: 0.75rem;
        }
        .section-h2 {
          font-size: clamp(1.6rem, 3vw, 2.25rem); font-weight: 800;
          letter-spacing: -0.5px; margin: 0 0 0.5rem; line-height: 1.2;
        }
        .section-sub { font-size: 1rem; color: rgba(255,255,255,0.4); margin: 0 0 3rem; }

        /* Features */
        .features-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
        }
        .feature-card {
          padding: 1.5rem; border-radius: 16px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
        }
        .feature-card:hover {
          border-color: var(--accent, rgba(255,255,255,0.15));
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        .feature-icon-wrap {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;
        }
        .feature-icon { font-size: 1.25rem; }
        .feature-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem; color: rgba(255,255,255,0.9); }
        .feature-desc  { font-size: 0.82rem; color: rgba(255,255,255,0.38); line-height: 1.6; margin: 0; }

        /* Steps */
        .steps-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; position: relative;
        }
        .step-card { position: relative; }
        .step-num {
          font-size: 3rem; font-weight: 900; letter-spacing: -2px; line-height: 1;
          background: linear-gradient(135deg, rgba(168,85,247,0.4), rgba(236,72,153,0.4));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 1rem;
        }
        .step-connector {
          position: absolute; top: 1.8rem; left: calc(100% + 1rem);
          right: calc(-100% - 1rem); height: 1px;
          background: linear-gradient(90deg, rgba(168,85,247,0.3), rgba(168,85,247,0.05));
        }
        .step-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem; color: rgba(255,255,255,0.9); }
        .step-desc  { font-size: 0.82rem; color: rgba(255,255,255,0.38); line-height: 1.65; margin: 0; }

        /* Domains */
        .domains-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        .domain-card {
          display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; cursor: pointer; transition: all 0.2s; text-decoration: none;
        }
        .domain-card:hover {
          background: rgba(255,255,255,0.055);
          border-color: var(--accent, rgba(255,255,255,0.15));
          transform: translateX(3px);
        }
        .domain-icon-wrap {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .domain-icon  { font-size: 1.15rem; }
        .domain-info  { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .domain-label { font-size: 0.88rem; font-weight: 700; }
        .domain-desc  { font-size: 0.73rem; color: rgba(255,255,255,0.3); }
        .domain-arrow { font-size: 0.85rem; color: rgba(255,255,255,0.2); transition: color 0.2s, transform 0.2s; }
        .domain-card:hover .domain-arrow { color: var(--accent, rgba(255,255,255,0.6)); transform: translateX(2px); }

        /* ─── CTA section ───────────────────────────────── */
        .cta-section {
          position: relative; z-index: 1; padding: 7rem 2rem;
          text-align: center; overflow: hidden;
        }
        .cta-orb {
          position: absolute; width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.2), transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .cta-inner { position: relative; max-width: 620px; margin: 0 auto; }
        .cta-h2 {
          font-size: clamp(1.8rem, 4vw, 2.75rem); font-weight: 900;
          letter-spacing: -1px; margin: 0.5rem 0 1rem; line-height: 1.15;
        }
        .cta-p { font-size: 1rem; color: rgba(255,255,255,0.4); margin: 0 0 2rem; }

        /* ─── Footer ────────────────────────────────────── */
        .footer {
          position: relative; z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 1.5rem 2rem;
        }
        .footer-inner {
          max-width: 1160px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
        }
        .footer-brand { font-size: 0.88rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
        .footer-copy  { font-size: 0.75rem; color: rgba(255,255,255,0.2); }

        /* ─── Responsive ────────────────────────────────── */
        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; gap: 3rem; padding: 4rem 1.5rem 3rem; }
          .hero-visual { order: -1; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .steps-grid { grid-template-columns: 1fr; gap: 2rem; }
          .step-connector { display: none; }
          .domains-grid { grid-template-columns: repeat(2, 1fr); }
          .stats-bar { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 580px) {
          .hero { padding: 3rem 1.25rem 2rem; }
          .features-grid { grid-template-columns: 1fr; }
          .domains-grid  { grid-template-columns: 1fr; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
          .nav-inner { padding: 0 1.25rem; }
          .footer-inner { flex-direction: column; gap: 0.5rem; text-align: center; }
        }
      `}</style>
    </div>
  );
}
