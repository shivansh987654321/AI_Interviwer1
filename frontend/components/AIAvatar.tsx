// components/AIAvatar.tsx
// ------------------------------------------------------------------
// Drop your interviewer photo at /public/interviewer.png
// The component overlays a realistic lip-sync animation on the mouth area.
// If no image, falls back to the CSS avatar.
// ------------------------------------------------------------------
import { useEffect, useRef } from 'react';

interface AIAvatarProps {
  isSpeaking?: boolean;
  difficulty_level?: 'warmup' | 'easy' | 'medium' | 'hard';
  // Path to your interviewer image placed in /public/
  imageSrc?: string;
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  warmup: { label: 'Introduction',  color: '#4ade80' },
  easy:   { label: 'Easy Level',    color: '#60a5fa' },
  medium: { label: 'Medium Level',  color: '#facc15' },
  hard:   { label: 'Hard Level',    color: '#f87171' },
};

export default function AIAvatar({
  isSpeaking = false,
  difficulty_level = 'warmup',
  imageSrc = '/interviewer.png',
}: AIAvatarProps) {

  const mouthRef   = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number | null>(null);
  const frameRef   = useRef(0);
  const imgErrRef  = useRef(false);

  // Animate lip-sync: cycle through mouth heights while speaking
  useEffect(() => {
    if (!isSpeaking) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mouthRef.current) {
        mouthRef.current.style.height = '3px';
        mouthRef.current.style.borderRadius = '3px';
      }
      return;
    }

    const MOUTH_SHAPES = [3, 6, 12, 18, 14, 8, 16, 10, 5, 13, 19, 7];
    let lastTime = 0;
    const FRAME_INTERVAL = 80; // ~12fps lip-sync

    const animate = (timestamp: number) => {
      if (timestamp - lastTime > FRAME_INTERVAL) {
        lastTime = timestamp;
        frameRef.current = (frameRef.current + 1) % MOUTH_SHAPES.length;
        if (mouthRef.current) {
          const h = MOUTH_SHAPES[frameRef.current];
          mouthRef.current.style.height = `${h}px`;
          mouthRef.current.style.borderRadius = h > 10 ? '50% 50% 50% 50% / 30% 30% 70% 70%' : '2px 2px 4px 4px';
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isSpeaking]);

  const diff = DIFFICULTY_LABELS[difficulty_level] || DIFFICULTY_LABELS.warmup;

  return (
    <div className="avatar-wrap">
      {/* Outer speaking ring */}
      {isSpeaking && (
        <>
          <div className="ring r1" />
          <div className="ring r2" />
        </>
      )}

      {/* Photo container */}
      <div className="photo-container">
        {/* Actual interviewer photo — place at /public/interviewer.png */}
        <img
          src={imageSrc}
          alt="Interviewer"
          className="interviewer-photo"
          onError={(e) => {
            // Fallback to CSS avatar if image missing
            imgErrRef.current = true;
            (e.target as HTMLImageElement).style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />

        {/* CSS fallback avatar (shown if no image) */}
        <div className="css-avatar" style={{ display: 'none' }}>
          <svg width="90" height="90" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="32" r="16" fill="#d4a574" />
            <ellipse cx="50" cy="22" rx="16" ry="8" fill="#3d2b1f" />
            <path d="M20 100 Q20 68 35 64 L50 70 L65 64 Q80 68 80 100Z" fill="#1e293b" />
            <path d="M42 64 L50 70 L58 64 L56 100 L44 100Z" fill="#f1f5f9" />
            <path d="M48 66 L50 72 L52 66 L51 90 L50 92 L49 90Z" fill="#7c3aed" />
            <rect x="44" y="47" width="12" height="18" rx="4" fill="#d4a574" />
          </svg>
        </div>

        {/* Lip-sync mouth overlay — positioned over mouth area of photo */}
        {/* Adjust bottom/left/width via CSS to match YOUR photo's mouth position */}
        <div className="mouth-overlay-container">
          <div ref={mouthRef} className={`mouth-overlay ${isSpeaking ? 'speaking' : ''}`} />
        </div>
      </div>

      {/* Waveform bars */}
      <div className={`waveform ${isSpeaking ? 'active' : ''}`}>
        {[0.4, 0.8, 1, 0.8, 0.4].map((scale, i) => (
          <div
            key={i}
            className="bar"
            style={{
              animationDelay: `${i * 0.12}s`,
              '--base-scale': scale,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Name + role */}
      <div className="name">Alex Chen</div>
      <div className="role">Senior Engineer · FAANG</div>

      {/* Difficulty badge */}
      <div className="diff-badge" style={{ color: diff.color, borderColor: `${diff.color}40`, background: `${diff.color}15` }}>
        <span className="diff-dot" style={{ background: diff.color }} />
        {diff.label}
      </div>

      {isSpeaking && <div className="speaking-pill">● Speaking</div>}

      <style jsx>{`
        .avatar-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          user-select: none;
        }

        /* Speaking rings */
        .ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(168,85,247,0.35);
          pointer-events: none;
          z-index: 0;
        }
        .r1 { width: 140px; height: 140px; top: -15px; left: -15px; animation: ringPulse 1.6s ease-out infinite; }
        .r2 { width: 165px; height: 165px; top: -27px; left: -27px; animation: ringPulse 1.6s ease-out infinite 0.55s; }
        @keyframes ringPulse {
          0%   { transform: scale(0.88); opacity: 0.8; }
          100% { transform: scale(1.12); opacity: 0; }
        }

        /* Photo container */
        .photo-container {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          overflow: hidden;
          position: relative;
          z-index: 1;
          border: 2px solid rgba(168,85,247,0.45);
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          background: #1e293b;
          flex-shrink: 0;
        }
        .interviewer-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          display: block;
        }
        .css-avatar {
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e293b, #0f172a);
        }

        /* Lip-sync overlay */
        /* ⚙️ Adjust bottom/left/width/transform to match YOUR photo's mouth position */
        .mouth-overlay-container {
          position: absolute;
          bottom: 22%;      /* distance from bottom of circle — tune this */
          left: 50%;
          transform: translateX(-50%);
          width: 38%;       /* width of mouth relative to face — tune this */
          display: flex;
          justify-content: center;
        }
        .mouth-overlay {
          width: 100%;
          height: 3px;
          background: rgba(0, 0, 0, 0.75);
          border-radius: 3px;
          transition: height 0.06s ease, border-radius 0.06s ease;
          /* Gives realistic dark shadow — blends with any photo */
          box-shadow: 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 2px rgba(0,0,0,0.8);
        }

        /* Waveform */
        .waveform {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 18px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .waveform.active { opacity: 1; }
        .bar {
          width: 3px;
          height: 4px;
          background: #a855f7;
          border-radius: 999px;
        }
        .waveform.active .bar {
          animation: barWave 0.7s ease-in-out infinite alternate;
          animation-duration: calc(0.6s + var(--base-scale, 1) * 0.2s);
        }
        @keyframes barWave {
          from { height: 4px; }
          to   { height: calc(4px + var(--base-scale, 1) * 14px); }
        }

        /* Text */
        .name {
          font-weight: 700;
          font-size: 0.95rem;
          color: rgba(255,255,255,0.9);
          margin-top: 2px;
        }
        .role {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.35);
          margin-top: -4px;
        }

        /* Difficulty badge */
        .diff-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 0.72rem;
          font-weight: 600;
          transition: all 0.4s ease;
          margin-top: 2px;
        }
        .diff-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Speaking pill */
        .speaking-pill {
          font-size: 0.68rem;
          color: #a855f7;
          font-weight: 600;
          animation: blink 1.2s ease-in-out infinite;
          margin-top: -2px;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}