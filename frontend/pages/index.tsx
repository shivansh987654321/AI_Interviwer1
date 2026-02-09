import { useUser } from "@clerk/nextjs";
import { useRouter } from 'next/router';
import { useState } from 'react';
import axios from 'axios';

// Define the Difficulty type properly
type Difficulty = 'easy' | 'medium' | 'hard';

// Define the response type from the backend
interface CreateInterviewResponse {
  sessionId: string;
  question: any;
}

export default function Home() {
  // ✅ 1. Get the current user
  const { user } = useUser(); 
  
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartInterview = async () => {
    if (!selectedDifficulty) return;

    setLoading(true);
    try {
      // 2. Call the Backend API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      
      const response = await axios.post<CreateInterviewResponse>(`${apiUrl}/api/interview/create`, {
        difficulty: selectedDifficulty,
        // Optional: We can pass the userId here if we want to associate the session immediately,
        // but for now, we are saving it at the end via the socket.
        userId: user ? user.id : undefined 
      });

      const { sessionId } = response.data;

      // 3. Redirect to the Interview Page
      router.push(`/interview/${sessionId}`);

    } catch (error: any) {
      console.error('Failed to create interview:', error);
      const errorMessage = error.response?.data?.error || 'Failed to connect to the server. Is the backend running?';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        <h1>DSA Interview Platform</h1>
        <p>Select a difficulty level to generate your question.</p>

        {/* Show a welcome message if logged in */}
        {user && <p className="welcome-text">Welcome back, {user.firstName}!</p>}

        <div className="difficulty-selector">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
            <button
              key={level}
              className={selectedDifficulty === level ? 'active capitalize' : 'capitalize'}
              onClick={() => setSelectedDifficulty(level)}
              disabled={loading}
            >
              {level} ({level === 'easy' ? '15' : level === 'medium' ? '30' : '45'} min)
            </button>
          ))}
        </div>

        <button
          className="start-button"
          onClick={handleStartInterview}
          disabled={!selectedDifficulty || loading}
        >
          {loading ? (
            <span className="loading-text">Starting Session...</span>
          ) : (
            'Start Interview 🚀'
          )}
        </button>
      </div>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
        }
        .container {
          background: white;
          width: 100%;
          max-width: 500px;
          padding: 3rem;
          text-align: center;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          color: #111;
          font-weight: 700;
        }
        p {
          font-size: 1rem;
          color: #666;
          margin-bottom: 2.5rem;
        }
        .welcome-text {
          color: #0070f3;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }
        .difficulty-selector {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        button {
          padding: 1rem;
          font-size: 1rem;
          border: 2px solid #eaeaea;
          background: white;
          color: #444;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        button.capitalize {
          text-transform: capitalize;
        }
        button:hover:not(:disabled) {
          border-color: #0070f3;
          color: #0070f3;
          transform: translateY(-2px);
        }
        button.active {
          background: #0070f3;
          border-color: #0070f3;
          color: white;
          box-shadow: 0 4px 14px 0 rgba(0, 118, 255, 0.39);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .start-button {
          width: 100%;
          padding: 1.2rem;
          font-size: 1.1rem;
          background: #111;
          color: white;
          border: none;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .start-button:hover:not(:disabled) {
          background: #000;
          transform: scale(1.02);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .loading-text {
          display: inline-block;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}