import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

/* ── data ─────────────────────────────────────────── */
const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#students', label: 'For students' },
  { href: '#faq', label: 'FAQ' },
];

const STEPS = [
  {
    num: '01',
    icon: '🎤',
    title: 'Verbal round',
    desc: 'The AI interviewer asks you warm-up and behavioural questions just like a real phone screen. Talk through your answers out loud.',
  },
  {
    num: '02',
    icon: '💻',
    title: 'Coding round',
    desc: 'Three progressive DSA problems in a real Monaco editor. Run your code against hidden test cases and get per-case results instantly.',
  },
  {
    num: '03',
    icon: '📊',
    title: 'Report card',
    desc: 'A written scorecard covering communication, technical knowledge, and problem-solving — ready the moment you finish.',
  },
];

const STATS = [
  { value: '12k+',  label: 'Problems solved' },
  { value: '2.4k+', label: 'Students enrolled' },
  { value: '4.9★',  label: 'Average rating' },
  { value: '27h',   label: 'Avg prep time saved' },
];

const FEATURES = [
  { icon: '🤖', title: 'AI Interviewer, Aha',      desc: 'A conversational AI that asks follow-ups, listens, and adapts to your answers — not just a static question bank.' },
  { icon: '⌨️', title: 'Real code editor',          desc: 'Monaco-powered editor with syntax highlighting, auto-complete, and multi-language support right in the browser.' },
  { icon: '🔁', title: 'Deterministic loops',       desc: "Every session follows the same interview structure your target company uses — no surprise format changes." },
  { icon: '🎙', title: 'Voice, both ways',           desc: 'Full duplex — speak your answers and hear the AI respond. Closest thing to a Zoom call without the anxiety.', dark: true },
  { icon: '✨', title: 'Unique every run',           desc: 'Questions are generated fresh each session. You can do 50 runs and never see the exact same problem twice.' },
  { icon: '📋', title: 'Report card',               desc: 'Scored rubric across communication, DSA fluency, and problem-solving with specific improvement pointers.' },
  { icon: '⚙️', title: 'Difficulty tiers',          desc: 'Easy → Medium → Hard. Each tier adjusts time limits, question complexity, and expected solution quality.' },
  { icon: '📈', title: 'Track your growth',         desc: 'Dashboard shows score trends, domain breakdown, streaks, and skill radar so you know exactly where to improve.' },
];

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    desc: 'Good enough to get started.',
    cta: 'Start for free',
    ctaStyle: 'outline',
    features: [
      '3 interviews / month',
      'Verbal round only',
      'Basic report card',
      'Community support',
    ],
    featured: false,
  },
  {
    name: 'Student Pro',
    price: '₹299',
    period: 'per month',
    desc: 'Everything, unlimited.',
    cta: 'Get Student Pro',
    ctaStyle: 'filled',
    features: [
      'Unlimited interviews',
      'Full coding round',
      'Detailed report card',
      'Resume-aware questions',
      'All 6 domains',
      'Priority support',
    ],
    featured: true,
  },
  {
    name: 'Campus',
    price: 'Custom',
    period: '',
    desc: 'For colleges & bootcamps.',
    cta: 'Contact us',
    ctaStyle: 'outline',
    features: [
      'Bulk student seats',
      'Admin dashboard',
      'Custom question banks',
      'Placement cell reports',
    ],
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    name: 'Aditi R.',
    role: 'Placed at Razorpay',
    avatar: 'AR',
    color: '#6366f1',
    text: "I practiced 18 sessions on Interviewer before my Razorpay round. The AI catches every time I'm vague — something my friends can't do at 2am. Got the offer.",
  },
  {
    name: 'Rohan M.',
    role: '3rd year, BITS Pilani',
    avatar: 'RM',
    color: '#f59e0b',
    text: "Used to panic during coding rounds. After two weeks of daily sessions, I stopped freezing. The deterministic structure trains muscle memory more than random Leetcode ever did.",
  },
  {
    name: 'Priya S.',
    role: 'Placed at Google',
    avatar: 'PS',
    color: '#10b981',
    text: "The report card is brutally honest. It told me my time complexity explanations were weak. I fixed that and cleared Google SWE in the next attempt. Worth every rupee.",
  },
];

const FAQS = [
  { q: 'Is the free plan really free?', a: 'Yes. Three full verbal-round interviews per month, forever, with no credit card required.' },
  { q: 'How is this different from LeetCode or HackerRank?', a: 'LeetCode gives you problems. We give you a full interview — voice warm-up, timed coding, and a written evaluation — the same end-to-end experience as a real tech interview.' },
  { q: 'Do you offer a student discount?', a: 'Student Pro is already priced for students at ₹299/month. Verify your .edu email for an additional 20% off.' },
  { q: "Can my college buy this for our mock tests?", a: 'Yes — reach out for Campus pricing. We work with placement cells to run batch mock seasons.' },
  { q: 'What languages and topics are covered?', a: 'JavaScript, Python, Java, C++, and Go for coding. DSA, Frontend, Backend, Full Stack, System Design, and HR Behavioral for domains.' },
  { q: 'Will my data be used to train AI models?', a: 'No. Your session transcripts and code are private and never used for model training. See our Privacy Policy.' },
  { q: "What's a round?", a: 'A round is one complete interview session: verbal warm-up → three coding problems → report card generation. Typically 30–45 minutes.' },
];

/* ── component ────────────────────────────────────── */
export default function LandingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleCTA = () => {
    if (isLoaded && user) router.push('/select');
    else router.push('/sign-up');
  };

  const ctaLabel = mounted && isLoaded && user ? 'Start practicing →' : 'Build your future →';

  return (
    <>
      <Head>
        <title>Interviewer — AI mock interviews that feel real</title>
        <meta name="description" content="Full technical interview loop — voice round, three DSA problems in a real code editor, and a written report card. Rehearse for FAANG-style interviews from your dorm room." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="root">

        {/* ── Navbar ───────────────────────────────── */}
        <header className="navbar">
          <div className="nav-inner">
            <Link href="/" className="nav-brand">
              <span className="brand-dot" />
              Interviewer
            </Link>
            <nav className="nav-links" aria-label="Main navigation">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
              ))}
            </nav>
            <div className="nav-actions">
              <Link href="/sign-in" className="nav-signin">Sign in</Link>
              <button className="nav-cta" onClick={handleCTA}>Start Free</button>
            </div>
          </div>
        </header>

        {/* ── Hero ─────────────────────────────────── */}
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-badge">
              <span className="badge-pip" />
              Trusted by students at IIT, BITS &amp; NITs
            </div>

            <h1 className="hero-h1">
              AI mock interviews<br />
              that feel <em>real.</em>
            </h1>

            <p className="hero-p">
              Interviewer puts you through the full technical loop — voice round,
              three DSA problems in a real code editor, and a written report card.
              Rehearse for FAANG-style interviews from your dorm room.
            </p>

            <div className="hero-actions">
              <button className="btn-primary" onClick={handleCTA}>{ctaLabel}</button>
              <a href="#how" className="btn-ghost">See how it works</a>
            </div>

            <div className="hero-social">
              <span className="stars">{'★★★★★'}</span>
              <span className="social-text">4.9 / 5 from 2,400+ students</span>
            </div>
          </div>

          {/* Product screenshot mockup */}
          <div className="hero-mockup" aria-hidden="true">
            <div className="mockup-window">
              <div className="mockup-bar">
                <span className="m-dot" /><span className="m-dot" /><span className="m-dot" />
                <span className="mockup-url">interviewer.app / session</span>
              </div>
              <div className="mockup-body">
                <div className="mock-sidebar">
                  <div className="mock-q active">Trapping Rain Water</div>
                  <div className="mock-q">Two Sum</div>
                  <div className="mock-q">LRU Cache</div>
                </div>
                <div className="mock-editor">
                  <div className="mock-code">
                    <span className="mk">function</span> <span className="mf">trap</span><span className="mp">(</span><span className="mv">height</span><span className="mp">)</span> <span className="mp">{'{'}</span>{'\n'}
                    {'  '}<span className="mk">let</span> <span className="mv">left</span> <span className="mo">=</span> <span className="mn">0</span><span className="mp">,</span> <span className="mv">right</span> <span className="mo">=</span> <span className="mv">height</span><span className="mp">.</span><span className="mf">length</span> <span className="mo">-</span> <span className="mn">1</span><span className="mp">;</span>{'\n'}
                    {'  '}<span className="mk">let</span> <span className="mv">water</span> <span className="mo">=</span> <span className="mn">0</span><span className="mp">;</span>{'\n'}
                    {'  '}<span className="mk">while</span> <span className="mp">(</span><span className="mv">left</span> <span className="mo">&lt;</span> <span className="mv">right</span><span className="mp">) {'{'}</span>{'\n'}
                    {'    '}<span className="mk">const</span> <span className="mv">minH</span> <span className="mo">=</span> <span className="mf">Math.min</span><span className="mp">(</span><span className="mv">height</span><span className="mp">[</span><span className="mv">left</span><span className="mp">],</span> <span className="mv">height</span><span className="mp">[</span><span className="mv">right</span><span className="mp">]);</span>{'\n'}
                    {'    '}<span className="mv">water</span> <span className="mo">+=</span> <span className="mv">minH</span><span className="mp">;</span>{'\n'}
                    {'  '}<span className="mp">{'}'}</span>{'\n'}
                    {'  '}<span className="mk">return</span> <span className="mv">water</span><span className="mp">;</span>{'\n'}
                    <span className="mp">{'}'}</span>
                  </div>
                  <div className="mock-result pass">✓ 2/3 test cases passed · Score 74</div>
                </div>
                <div className="mock-voice">
                  <div className="mock-voice-label">🎤 AI Interviewer</div>
                  <div className="mock-voice-text">"Can you explain why you chose the two-pointer approach here?"</div>
                  <div className="mock-waveform">
                    {[3,7,12,9,5,14,8,4,11,6,3,9,13,7,5].map((h, i) => (
                      <span key={i} className="wf-bar" style={{ height: `${h}px` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────── */}
        <section className="section-lavender" id="how">
          <div className="section-inner">
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-h2">
              From sign-up to <em>signed</em><br />report in 30 minutes.
            </h2>
            <p className="section-sub">No scheduling. No email lag. The AI takes you through the interview loop.</p>

            <div className="steps-grid">
              {STEPS.map(s => (
                <div key={s.num} className="step-card">
                  <div className="step-icon">{s.icon}</div>
                  <div className="step-num">{s.num}</div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────── */}
        <div className="stats-strip">
          {STATS.map((s, i) => (
            <div key={s.label} className="stat-cell">
              <span className="stat-val">{s.value}</span>
              <span className="stat-lbl">{s.label}</span>
              {i < STATS.length - 1 && <span className="stat-divider" />}
            </div>
          ))}
        </div>

        {/* ── Features ─────────────────────────────── */}
        <section className="section-white" id="features">
          <div className="section-inner">
            <div className="section-eyebrow">Features</div>
            <h2 className="section-h2 dark">
              Every detail of a real interview,<br /><em>without the nerves.</em>
            </h2>
            <p className="section-sub dark">From the editor to the voice, every sub-skill is built to put you exactly where you'd be on the other side of a Zoom call.</p>

            <div className="features-grid">
              {FEATURES.map(f => (
                <div key={f.title} className={`feature-card ${f.dark ? 'feature-dark' : ''}`}>
                  <span className="f-icon">{f.icon}</span>
                  <h3 className="f-title">{f.title}</h3>
                  <p className="f-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────── */}
        <section className="section-lavender" id="pricing">
          <div className="section-inner">
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-h2">
              Start free. <em>Upgrade</em><br />when you're serious.
            </h2>
            <p className="section-sub">No sneaky trials. Student Pro pays for itself if it gets you one offer.</p>

            <div className="pricing-grid">
              {PLANS.map(p => (
                <div key={p.name} className={`pricing-card ${p.featured ? 'pricing-featured' : ''}`}>
                  {p.featured && <div className="pricing-badge">Most popular</div>}
                  <div className="pricing-name">{p.name}</div>
                  <div className="pricing-price">
                    {p.price}
                    {p.period && <span className="pricing-period"> / {p.period}</span>}
                  </div>
                  <p className="pricing-desc">{p.desc}</p>
                  <button
                    className={`pricing-cta ${p.ctaStyle === 'filled' ? 'pricing-cta-filled' : 'pricing-cta-outline'}`}
                    onClick={handleCTA}
                  >
                    {p.cta}
                  </button>
                  <ul className="pricing-features">
                    {p.features.map(f => (
                      <li key={f}>
                        <span className="check">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="pricing-note">All prices in INR · Cancel anytime · No auto-renewal without consent</p>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────── */}
        <section className="section-white" id="students">
          <div className="section-inner">
            <div className="section-eyebrow">Reviews</div>
            <h2 className="section-h2 dark">
              Rehearse until it feels <em>boring.</em>
            </h2>
            <p className="section-sub dark">Students who went from panicking in mock rounds to clearing final interviews.</p>

            <div className="testimonials-grid">
              {TESTIMONIALS.map(t => (
                <div key={t.name} className="testimonial-card">
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    <div className="testimonial-avatar" style={{ background: t.color }}>{t.avatar}</div>
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      <div className="testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────── */}
        <section className="section-lavender" id="faq">
          <div className="section-inner faq-inner">
            <div>
              <div className="section-eyebrow">FAQ</div>
              <h2 className="section-h2">Quick <em>questions.</em></h2>
            </div>
            <div className="faq-list">
              {FAQS.map((f, i) => (
                <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {f.q}
                    <span className="faq-chevron">{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && <p className="faq-a">{f.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────── */}
        <section className="cta-dark">
          <div className="cta-stars" aria-hidden="true">
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i} className="star" style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${(i * 0.15) % 3}s`,
                width: `${1 + (i % 3)}px`,
                height: `${1 + (i % 3)}px`,
              }} />
            ))}
          </div>
          <div className="cta-content">
            <h2 className="cta-h2">
              Your next interview<br />is <em>waiting.</em>
            </h2>
            <div className="cta-actions">
              <button className="btn-primary" onClick={handleCTA}>Start Free →</button>
              <a href="#pricing" className="cta-link">See pricing</a>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-left">
              <span className="footer-brand">
                <span className="brand-dot" />Interviewer
              </span>
              <p className="footer-tagline">The AI that actually interviews you.</p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <div className="footer-col-title">Product</div>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#how">How it works</a>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Company</div>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Support</div>
                <a href="#">FAQ</a>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 Interviewer. All rights reserved.</span>
            <div className="footer-swatches">
              {['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899'].map(c => (
                <span key={c} className="swatch" style={{ background: c }} />
              ))}
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; color: #111; -webkit-font-smoothing: antialiased; }
      `}</style>

      <style jsx>{`
        /* ── Root ─────────────────────────────────── */
        .root { min-height: 100vh; }

        /* ── Tokens ───────────────────────────────── */
        /* Lavender bg: #e8e8f5 */

        /* ── Navbar ───────────────────────────────── */
        .navbar {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .nav-inner {
          max-width: 1160px; margin: 0 auto; padding: 0 2rem;
          height: 58px; display: flex; align-items: center; gap: 2rem;
        }
        .nav-brand {
          font-size: 1rem; font-weight: 800; color: #111; text-decoration: none;
          display: flex; align-items: center; gap: 7px; white-space: nowrap;
        }
        .brand-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #6366f1; flex-shrink: 0;
        }
        .nav-links { display: flex; align-items: center; gap: 0.25rem; flex: 1; }
        .nav-link {
          font-size: 0.85rem; color: #555; text-decoration: none;
          padding: 0.4rem 0.7rem; border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover { color: #111; background: rgba(0,0,0,0.04); }
        .nav-actions { display: flex; align-items: center; gap: 0.5rem; }
        .nav-signin {
          font-size: 0.85rem; color: #555; text-decoration: none;
          padding: 0.4rem 0.85rem; border-radius: 8px; transition: color 0.15s;
        }
        .nav-signin:hover { color: #111; }
        .nav-cta {
          font-size: 0.85rem; font-weight: 700; color: #fff;
          background: #111; border: none; border-radius: 8px;
          padding: 0.5rem 1.1rem; cursor: pointer; transition: opacity 0.15s;
        }
        .nav-cta:hover { opacity: 0.82; }

        /* ── Shared buttons ───────────────────────── */
        .btn-primary {
          font-size: 0.95rem; font-weight: 700; color: #fff;
          background: #111; border: none; border-radius: 10px;
          padding: 0.75rem 1.6rem; cursor: pointer; transition: opacity 0.15s, transform 0.15s;
          white-space: nowrap;
        }
        .btn-primary:hover { opacity: 0.82; transform: translateY(-1px); }
        .btn-ghost {
          font-size: 0.9rem; color: #555; text-decoration: none;
          border: 1px solid rgba(0,0,0,0.15); border-radius: 10px;
          padding: 0.72rem 1.4rem; transition: border-color 0.15s, color 0.15s;
        }
        .btn-ghost:hover { border-color: #999; color: #111; }

        /* ── Section helpers ──────────────────────── */
        .section-lavender { background: #e8e8f5; padding: 5rem 2rem; }
        .section-white    { background: #fff;    padding: 5rem 2rem; }
        .section-inner    { max-width: 1160px; margin: 0 auto; }
        .section-eyebrow  {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 2.5px;
          text-transform: uppercase; color: #6366f1; margin-bottom: 0.6rem;
        }
        .section-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(1.9rem, 3.5vw, 2.6rem);
          font-weight: 400; line-height: 1.2; color: #e8e8f5; margin-bottom: 0.75rem;
        }
        .section-h2.dark { color: #111; }
        .section-h2 em { font-style: italic; color: #6366f1; }
        .section-sub { font-size: 1rem; color: rgba(232,232,245,0.65); max-width: 560px; line-height: 1.65; margin-bottom: 3rem; }
        .section-sub.dark { color: #666; }

        /* ── Hero ─────────────────────────────────── */
        .hero {
          background: #e8e8f5;
          padding: 5rem 2rem 0;
          display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: flex-start;
          max-width: 1160px; margin: 0 auto;
          /* stretch to edges on lavender bg */
        }
        /* make hero fill full width with lavender */
        :global(.root > .hero) { max-width: none; }
        :global(.root > .hero) .hero-inner,
        :global(.root > .hero) .hero-mockup {
          max-width: 580px;
        }
        /* workaround: wrap hero in a full-width lavender band */
        .hero {
          background: none;
          max-width: 1160px;
        }

        .hero-inner { display: flex; flex-direction: column; gap: 1.5rem; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 0.78rem; color: #6366f1; font-weight: 600;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 999px; padding: 0.3rem 0.9rem; width: fit-content;
        }
        .badge-pip {
          width: 6px; height: 6px; border-radius: 50%; background: #6366f1;
          animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .hero-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(2.4rem, 4.5vw, 3.4rem); font-weight: 400;
          line-height: 1.15; color: #111;
        }
        .hero-h1 em { font-style: italic; color: #6366f1; }
        .hero-p { font-size: 1.02rem; color: #555; line-height: 1.7; max-width: 480px; }
        .hero-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .hero-social { display: flex; align-items: center; gap: 0.6rem; }
        .stars { color: #f59e0b; font-size: 0.85rem; letter-spacing: 1px; }
        .social-text { font-size: 0.78rem; color: #888; }

        /* Mockup */
        .hero-mockup { align-self: flex-end; }
        .mockup-window {
          background: #1a1a2e; border-radius: 12px 12px 0 0;
          overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          font-family: 'SF Mono','Fira Code',monospace;
        }
        .mockup-bar {
          background: #13131f; padding: 10px 14px;
          display: flex; align-items: center; gap: 6px;
        }
        .m-dot { width: 10px; height: 10px; border-radius: 50%; background: #333; }
        .m-dot:first-child { background: #ff5f57; }
        .m-dot:nth-child(2) { background: #febc2e; }
        .m-dot:nth-child(3) { background: #28c840; }
        .mockup-url { margin-left: auto; font-size: 0.68rem; color: #444; }
        .mockup-body {
          display: grid; grid-template-columns: 160px 1fr 180px;
          min-height: 220px;
        }
        .mock-sidebar {
          background: #13131f; border-right: 1px solid #222;
          padding: 12px 8px; display: flex; flex-direction: column; gap: 4px;
        }
        .mock-q {
          font-size: 0.68rem; color: #555; padding: 6px 8px; border-radius: 6px;
          cursor: default;
        }
        .mock-q.active { background: rgba(99,102,241,0.15); color: #818cf8; }
        .mock-editor { padding: 14px 16px; border-right: 1px solid #222; }
        .mock-code {
          font-size: 0.7rem; color: #cdd6f4; white-space: pre; line-height: 1.8;
        }
        .mk { color: #cba6f7; } .mf { color: #89b4fa; } .mv { color: #fab387; }
        .mp { color: #a6adc8; } .mo { color: #89dceb; } .mn { color: #fab387; }
        .mock-result {
          margin-top: 10px; font-size: 0.68rem; padding: 5px 10px;
          border-radius: 6px;
        }
        .mock-result.pass { background: rgba(74,222,128,0.1); color: #4ade80; }
        .mock-voice {
          padding: 14px 12px; display: flex; flex-direction: column; gap: 8px;
        }
        .mock-voice-label { font-size: 0.65rem; color: #6366f1; font-weight: 600; }
        .mock-voice-text { font-size: 0.68rem; color: #a0aec0; line-height: 1.5; }
        .mock-waveform { display: flex; align-items: center; gap: 2px; margin-top: 4px; }
        .wf-bar {
          width: 3px; border-radius: 2px; background: #6366f1;
          display: inline-block; animation: wavebar 1.2s ease-in-out infinite alternate;
        }
        @keyframes wavebar { from{transform:scaleY(0.3)} to{transform:scaleY(1)} }

        /* ── Hero wrapper for full-width bg ─────── */
        /* We wrap hero section in a full-width lavender band via a wrapper div below */

        /* ── Steps ────────────────────────────────── */
        .steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; }
        .step-card {
          background: #fff; border-radius: 16px; padding: 1.75rem;
          border: 1px solid rgba(0,0,0,0.06); position: relative;
        }
        .step-icon { font-size: 1.5rem; margin-bottom: 0.75rem; display: block; }
        .step-num {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 0.75rem; color: #aaa; font-weight: 400;
          margin-bottom: 0.5rem;
        }
        .step-title { font-size: 0.95rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
        .step-desc { font-size: 0.82rem; color: #666; line-height: 1.65; }

        /* ── Stats ────────────────────────────────── */
        .stats-strip {
          display: grid; grid-template-columns: repeat(4,1fr);
          border-top: 1px solid rgba(0,0,0,0.07);
          border-bottom: 1px solid rgba(0,0,0,0.07);
          background: #fff;
        }
        .stat-cell {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; padding: 1.75rem 1rem; position: relative;
        }
        .stat-val {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 2rem; font-weight: 400; color: #111; line-height: 1;
        }
        .stat-lbl { font-size: 0.78rem; color: #888; }
        .stat-divider {
          position: absolute; right: 0; top: 20%; height: 60%;
          width: 1px; background: rgba(0,0,0,0.07);
        }

        /* ── Features ─────────────────────────────── */
        .features-grid {
          display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem;
        }
        .feature-card {
          padding: 1.4rem; border-radius: 14px;
          background: #f7f7fb; border: 1px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .feature-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .feature-dark {
          background: #1a1a2e; border-color: #333;
          grid-column: span 2;
        }
        .f-icon { font-size: 1.3rem; display: block; margin-bottom: 0.75rem; }
        .f-title { font-size: 0.88rem; font-weight: 700; color: #111; margin-bottom: 0.4rem; }
        .feature-dark .f-title { color: #e2e8f0; }
        .f-desc { font-size: 0.78rem; color: #777; line-height: 1.6; }
        .feature-dark .f-desc { color: #94a3b8; }

        /* ── Pricing ──────────────────────────────── */
        .pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.25rem; margin-bottom: 1.25rem; }
        .pricing-card {
          background: #fff; border-radius: 16px; padding: 1.75rem;
          border: 1px solid rgba(0,0,0,0.08); position: relative;
        }
        .pricing-featured {
          border: 2px solid #6366f1;
          box-shadow: 0 8px 32px rgba(99,102,241,0.15);
        }
        .pricing-badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          background: #6366f1; color: #fff; font-size: 0.7rem; font-weight: 700;
          padding: 3px 12px; border-radius: 999px; white-space: nowrap;
        }
        .pricing-name { font-size: 0.85rem; font-weight: 700; color: #888; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; }
        .pricing-price {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 2.2rem; font-weight: 400; color: #111; line-height: 1;
        }
        .pricing-period { font-size: 0.78rem; color: #aaa; font-family: 'Inter', sans-serif; }
        .pricing-desc { font-size: 0.82rem; color: #888; margin: 0.5rem 0 1.25rem; }
        .pricing-cta {
          width: 100%; padding: 0.65rem 1rem; border-radius: 8px; font-size: 0.85rem;
          font-weight: 700; cursor: pointer; transition: all 0.15s; margin-bottom: 1.25rem;
        }
        .pricing-cta-filled { background: #111; color: #fff; border: none; }
        .pricing-cta-filled:hover { opacity: 0.82; }
        .pricing-cta-outline { background: transparent; color: #111; border: 1.5px solid rgba(0,0,0,0.2); }
        .pricing-cta-outline:hover { border-color: #111; }
        .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
        .pricing-features li { font-size: 0.82rem; color: #444; display: flex; align-items: flex-start; gap: 6px; }
        .check { color: #6366f1; font-weight: 700; flex-shrink: 0; }
        .pricing-note { font-size: 0.72rem; color: #aaa; text-align: center; }

        /* ── Testimonials ─────────────────────────── */
        .testimonials-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.25rem; }
        .testimonial-card {
          background: #f7f7fb; border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 1.25rem;
        }
        .testimonial-text { font-size: 0.88rem; color: #333; line-height: 1.7; flex: 1; }
        .testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
        .testimonial-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .testimonial-name { font-size: 0.85rem; font-weight: 700; color: #111; }
        .testimonial-role { font-size: 0.75rem; color: #888; }

        /* ── FAQ ──────────────────────────────────── */
        .faq-inner { display: grid; grid-template-columns: 280px 1fr; gap: 4rem; align-items: flex-start; }
        .faq-list { display: flex; flex-direction: column; }
        .faq-item { border-bottom: 1px solid rgba(0,0,0,0.1); }
        .faq-q {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; padding: 1.1rem 0; background: none; border: none;
          font-size: 0.9rem; font-weight: 600; color: #111; cursor: pointer;
          text-align: left; transition: color 0.15s;
        }
        .faq-q:hover { color: #6366f1; }
        .faq-chevron { font-size: 1.1rem; color: #6366f1; flex-shrink: 0; }
        .faq-a { font-size: 0.84rem; color: #666; line-height: 1.7; padding-bottom: 1rem; }

        /* ── Final CTA ────────────────────────────── */
        .cta-dark {
          background: #0d0d1a; padding: 6rem 2rem;
          text-align: center; position: relative; overflow: hidden;
        }
        .cta-stars { position: absolute; inset: 0; pointer-events: none; }
        .star {
          position: absolute; border-radius: 50%;
          background: rgba(255,255,255,0.5);
          animation: twinkle 3s ease-in-out infinite;
        }
        @keyframes twinkle { 0%,100%{opacity:0.2} 50%{opacity:0.8} }
        .cta-content { position: relative; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2rem; }
        .cta-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(2rem, 4vw, 3rem); font-weight: 400;
          color: #fff; line-height: 1.2;
        }
        .cta-h2 em { font-style: italic; color: #818cf8; }
        .cta-actions { display: flex; align-items: center; gap: 1rem; }
        .cta-link { font-size: 0.88rem; color: rgba(255,255,255,0.45); text-decoration: none; transition: color 0.15s; }
        .cta-link:hover { color: rgba(255,255,255,0.8); }

        /* ── Footer ───────────────────────────────── */
        .footer { background: #fff; border-top: 1px solid rgba(0,0,0,0.07); padding: 3rem 2rem 1.5rem; }
        .footer-inner {
          max-width: 1160px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; padding-bottom: 2rem;
          border-bottom: 1px solid rgba(0,0,0,0.07);
        }
        .footer-brand {
          font-size: 0.95rem; font-weight: 800; color: #111;
          display: flex; align-items: center; gap: 7px; margin-bottom: 0.5rem;
        }
        .footer-tagline { font-size: 0.8rem; color: #888; }
        .footer-cols { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
        .footer-col { display: flex; flex-direction: column; gap: 0.5rem; }
        .footer-col-title { font-size: 0.78rem; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem; }
        .footer-col a { font-size: 0.82rem; color: #888; text-decoration: none; transition: color 0.15s; }
        .footer-col a:hover { color: #111; }
        .footer-bottom {
          max-width: 1160px; margin: 1.25rem auto 0;
          display: flex; align-items: center; justify-content: space-between;
        }
        .footer-bottom span { font-size: 0.75rem; color: #bbb; }
        .footer-swatches { display: flex; gap: 6px; }
        .swatch { width: 14px; height: 14px; border-radius: 50%; }

        /* ── Responsive ───────────────────────────── */
        @media (max-width: 1024px) {
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .feature-dark { grid-column: span 1; }
        }
        @media (max-width: 880px) {
          .hero { grid-template-columns: 1fr; }
          .hero-mockup { display: none; }
          .steps-grid { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .faq-inner { grid-template-columns: 1fr; gap: 1.5rem; }
          .stats-strip { grid-template-columns: repeat(2,1fr); }
          .footer-inner { grid-template-columns: 1fr; }
          .footer-cols { grid-template-columns: repeat(3,1fr); }
          .nav-links { display: none; }
        }
        @media (max-width: 580px) {
          .section-lavender, .section-white { padding: 3.5rem 1.25rem; }
          .features-grid { grid-template-columns: 1fr; }
          .stats-strip { grid-template-columns: 1fr 1fr; }
          .hero { padding: 3rem 1.25rem 0; }
          .nav-inner { padding: 0 1.25rem; }
        }
      `}</style>
    </>
  );
}
