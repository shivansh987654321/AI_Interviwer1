// components/AIAvatar.tsx

interface AIAvatarProps {
  isSpeaking?: boolean;
}

export default function AIAvatar({ isSpeaking = false }: AIAvatarProps) {
  // That's it. No useState, no useEffect needed.
  // The parent controls this prop — we just use it.

  return (
    <div className="avatar-container">
      <div className={`avatar ${isSpeaking ? 'speaking' : ''}`}>
        <div className="avatar-face">
          <div className="eye left"></div>
          <div className="eye right"></div>
          <div className={`mouth ${isSpeaking ? 'talking' : ''}`}></div>
        </div>
        {isSpeaking && (
          <div className="sound-waves">
            <span></span><span></span><span></span>
          </div>
        )}
      </div>
      <div className="avatar-label">AI Interviewer</div>
      {isSpeaking && <div className="speaking-badge">Speaking…</div>}

      <style jsx>{`
        .avatar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .avatar {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .avatar.speaking {
          animation: pulse 1s infinite;
          box-shadow: 0 0 30px rgba(102, 126, 234, 0.6);
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .avatar-face {
          width: 80px;
          height: 80px;
          position: relative;
        }
        .eye {
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 25px;
        }
        .eye.left { left: 20px; }
        .eye.right { right: 20px; }
        .mouth {
          width: 30px;
          height: 15px;
          border: 3px solid white;
          border-top: none;
          border-radius: 0 0 30px 30px;
          position: absolute;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          transition: height 0.15s;
        }
        .mouth.talking {
          animation: talk 0.35s infinite alternate;
        }
        @keyframes talk {
          0% { height: 8px; }
          50% { height: 18px; }
          100% { height: 10px; }
        }
        .sound-waves {
          position: absolute;
          bottom: -10px;
          display: flex;
          gap: 3px;
        }
        .sound-waves span {
          width: 4px;
          background: #667eea;
          border-radius: 2px;
          animation: wave 0.6s infinite ease-in-out;
        }
        .sound-waves span:nth-child(1) { height: 12px; animation-delay: 0s; }
        .sound-waves span:nth-child(2) { height: 18px; animation-delay: 0.15s; }
        .sound-waves span:nth-child(3) { height: 12px; animation-delay: 0.3s; }
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
        .avatar-label {
          margin-top: 1rem;
          font-weight: 600;
          color: #333;
        }
        .speaking-badge {
          margin-top: 0.4rem;
          font-size: 0.75rem;
          color: #667eea;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
}