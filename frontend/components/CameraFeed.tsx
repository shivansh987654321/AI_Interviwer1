import { useEffect, useRef, useState } from 'react';

export default function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Camera is mandatory - request access on mount
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        setError('Camera access denied. Please enable camera to continue.');
        console.error('Camera error:', err);
      });

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="camera-container">
      {error ? (
        <div className="camera-error">{error}</div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          <div className="camera-overlay">
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              Recording
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .camera-container {
          position: relative;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16/9;
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 1rem;
          background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
        }
        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
          font-size: 0.9rem;
        }
        .recording-dot {
          width: 10px;
          height: 10px;
          background: #ff0000;
          border-radius: 50%;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .camera-error {
          padding: 2rem;
          text-align: center;
          color: #ff0000;
          background: #ffe0e0;
        }
      `}</style>
    </div>
  );
}
