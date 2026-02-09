import { useState, useEffect } from 'react';

export default function AIAvatar() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // TODO: Integrate with text-to-speech for AI responses
    // TODO: Animate avatar based on speaking state
  }, [isSpeaking]);

  return (
    <div className="avatar-container">
      <div className={`avatar ${isSpeaking ? 'speaking' : ''}`}>
        <div className="avatar-face">
          <div className="eye left"></div>
          <div className="eye right"></div>
          <div className="mouth"></div>
        </div>
      </div>
      <div className="avatar-label">AI Interviewer</div>

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
          transition: transform 0.3s;
        }
        .avatar.speaking {
          animation: pulse 1s infinite;
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
        .eye.left {
          left: 20px;
        }
        .eye.right {
          right: 20px;
        }
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
        }
        .avatar-label {
          margin-top: 1rem;
          font-weight: 600;
          color: #333;
        }
      `}</style>
    </div>
  );
}
