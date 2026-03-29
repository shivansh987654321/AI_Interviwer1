// components/CameraFeed.tsx
// Anti-cheat camera:
// 1. Camera must stay ON throughout interview
// 2. Face-presence check via skin-tone pixel heuristic (no external API needed)
// 3. Reports cheat events via onCheatEvent callback
// 4. Tab/window visibility change detection
// Optional: Pass useCloudVision=true to send frames to your own vision API endpoint

import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraFeedProps {
  sessionId: string;
  onCheatEvent?: (type: string, detail?: string) => void;
  // Set to true and provide apiEndpoint to use server-side face detection
  useServerDetection?: boolean;
  apiEndpoint?: string;
}

type CameraStatus = 'requesting' | 'active' | 'denied' | 'error';

export default function CameraFeed({
  sessionId,
  onCheatEvent,
  useServerDetection = false,
  apiEndpoint = 'http://localhost:5001',
}: CameraFeedProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus]           = useState<CameraStatus>('requesting');
  const [facePresent, setFacePresent] = useState(true);
  const [warnings, setWarnings]       = useState<string[]>([]);
  const [tabWarning, setTabWarning]   = useState(false);

  const faceAbsenceCountRef = useRef(0);
  const checkIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabSwitchCountRef   = useRef(0);
  // Ref keeps latest onCheatEvent without causing effects to re-run
  const onCheatEventRef = useRef(onCheatEvent);
  useEffect(() => { onCheatEventRef.current = onCheatEvent; }, [onCheatEvent]);

  const addWarning = useCallback((msg: string) => {
    setWarnings(prev => [...prev.slice(-4), msg]);
  }, []);

  // ------------------------------------------------------------------
  // Start camera
  // ------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: false,
    }).then(stream => {
      if (!mounted) return;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStatus('active');
    }).catch(() => {
      if (!mounted) return;
      setStatus('denied');
      onCheatEventRef.current?.('camera_denied', 'Camera access was denied');
    });

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // Tab / window visibility detection
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current++;
        setTabWarning(true);
        addWarning(`⚠️ Tab switch detected (#${tabSwitchCountRef.current})`);
        onCheatEventRef.current?.('tab_switch', `count:${tabSwitchCountRef.current}`);
        setTimeout(() => setTabWarning(false), 3000);
      }
    };

    const handleBlur = () => {
      // Use a short delay: if document.hidden becomes true within 100ms,
      // it was a tab switch (already counted by visibilitychange) — skip.
      // If document.hidden is still false, it's a genuine window-focus-lost event.
      setTimeout(() => {
        if (!document.hidden) {
          tabSwitchCountRef.current++;
          setTabWarning(true);
          addWarning(`⚠️ Window focus lost (#${tabSwitchCountRef.current})`);
          onCheatEventRef.current?.('tab_switch', `window_blur:${tabSwitchCountRef.current}`);
          setTimeout(() => setTabWarning(false), 3000);
        }
      }, 100);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [addWarning]);

  // ------------------------------------------------------------------
  // Face presence check (every 3s)
  // Client-side heuristic: sample pixels for skin-tone range
  // For production: replace with actual face detection API call
  // ------------------------------------------------------------------
  const handleFaceResult = useCallback((detected: boolean) => {
    setFacePresent(detected);
    if (!detected) {
      faceAbsenceCountRef.current++;
      if (faceAbsenceCountRef.current >= 2) { // 2 consecutive misses = report
        addWarning('⚠️ Face not visible');
        onCheatEventRef.current?.('face_absent', `count:${faceAbsenceCountRef.current}`);
      }
    } else {
      faceAbsenceCountRef.current = 0;
    }
  }, [addWarning]);

  const checkFacePresence = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || status !== 'active') return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.videoWidth === 0) return;

    canvas.width  = 80;
    canvas.height = 60;
    ctx.drawImage(video, 0, 0, 80, 60);

    if (useServerDetection) {
      // Send frame to server endpoint for real face detection
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const formData = new FormData();
          formData.append('frame', blob, 'frame.jpg');
          formData.append('sessionId', sessionId);
          const res = await fetch(`${apiEndpoint}/api/interview/check-face`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          handleFaceResult(data.faceDetected);
        } catch {
          // Silently ignore network errors on face check
        }
      }, 'image/jpeg', 0.5);
      return;
    }

    // Client-side heuristic: scan center region for skin-tone pixels
    const imageData = ctx.getImageData(20, 10, 40, 40);
    const pixels    = imageData.data;
    let skinPixels  = 0;
    const total     = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      // Broad skin-tone detection: works for most skin tones
      const isSkin = (
        r > 60 && g > 40 && b > 20 &&
        r > g && r > b &&
        (r - g) > 10 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 10
      );
      if (isSkin) skinPixels++;
    }

    const skinRatio = skinPixels / total;
    handleFaceResult(skinRatio > 0.08); // >8% skin pixels = face likely present
  }, [status, sessionId, useServerDetection, apiEndpoint, handleFaceResult]);

  useEffect(() => {
    if (status !== 'active') return;
    checkIntervalRef.current = setInterval(checkFacePresence, 3000);
    return () => { if (checkIntervalRef.current) clearInterval(checkIntervalRef.current); };
  }, [status, checkFacePresence]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="camera-wrap">
      {/* Live feed */}
      <div className={`video-container ${!facePresent ? 'face-absent' : ''} ${tabWarning ? 'tab-warn' : ''}`}>
        {status === 'requesting' && (
          <div className="overlay-msg">
            <div className="spinner" />
            <span>Requesting camera...</span>
          </div>
        )}
        {status === 'denied' && (
          <div className="overlay-msg error">
            <span className="err-icon">📷</span>
            <span>Camera blocked</span>
            <small>Enable camera access in browser settings</small>
          </div>
        )}

        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ display: status === 'active' ? 'block' : 'none' }}
          className="video-el"
        />

        {/* Hidden canvas for pixel analysis */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Status badge */}
        {status === 'active' && (
          <div className="cam-badges">
            <div className={`rec-badge ${facePresent ? '' : 'warn'}`}>
              <span className="rec-dot" />
              {facePresent ? 'REC' : 'NO FACE'}
            </div>
            {tabWarning && (
              <div className="tab-badge">TAB SWITCH!</div>
            )}
          </div>
        )}

        {/* Face absence overlay */}
        {status === 'active' && !facePresent && (
          <div className="face-absent-overlay">
            <span>👁️</span>
            <span>Face not visible</span>
          </div>
        )}
      </div>

      {/* Warning log */}
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.slice(-3).map((w, i) => (
            <div key={i} className="warn-item">{w}</div>
          ))}
        </div>
      )}

      {/* Label */}
      <div className="cam-label">
        <span className={`status-dot ${status === 'active' ? (facePresent ? 'green' : 'red') : 'gray'}`} />
        You
      </div>

      <style jsx>{`
        .camera-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        .video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: 12px;
          overflow: hidden;
          background: #0a0a0e;
          border: 1.5px solid rgba(255,255,255,0.08);
          transition: border-color 0.3s;
        }
        .video-container.face-absent {
          border-color: rgba(248,113,113,0.5);
          box-shadow: 0 0 0 2px rgba(248,113,113,0.15);
        }
        .video-container.tab-warn {
          border-color: rgba(250,204,21,0.6);
          box-shadow: 0 0 0 2px rgba(250,204,21,0.2);
          animation: tabFlash 0.3s ease 3;
        }
        @keyframes tabFlash {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
        .video-el {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* mirror for natural selfie view */
        }
        .overlay-msg {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: rgba(255,255,255,0.4);
          font-size: 0.78rem;
          text-align: center;
          padding: 12px;
        }
        .overlay-msg.error { color: #f87171; }
        .err-icon { font-size: 1.5rem; }
        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Badges */
        .cam-badges {
          position: absolute;
          top: 8px;
          left: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rec-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(6px);
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 0.62rem;
          font-weight: 700;
          color: #4ade80;
          letter-spacing: 0.5px;
        }
        .rec-badge.warn { color: #f87171; }
        .rec-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: currentColor;
          animation: blink 1s ease-in-out infinite;
        }
        .tab-badge {
          background: rgba(250,204,21,0.85);
          color: #000;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* Face absent overlay */
        .face-absent-overlay {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(239,68,68,0.85);
          color: white;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        /* Warnings */
        .warnings {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .warn-item {
          font-size: 0.68rem;
          color: #fbbf24;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.15);
          padding: 3px 8px;
          border-radius: 6px;
        }

        /* Label */
        .cam-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.35);
          font-weight: 500;
        }
        .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .status-dot.green { background: #4ade80; }
        .status-dot.red   { background: #f87171; }
        .status-dot.gray  { background: #64748b; }
      `}</style>
    </div>
  );
}