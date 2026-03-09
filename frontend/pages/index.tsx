import { useUser, SignOutButton } from "@clerk/nextjs";
import { useRouter } from 'next/router';
import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

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
      {/* ── Top Nav ── */}
      <nav className="navbar">
        <span className="nav-brand">AI Interviewer</span>
        <div className="nav-links">
          {user ? (
            <>
              <Link href="/history" className="nav-link">📋 History</Link>
              <span className="nav-user">👋 {user.firstName || user.emailAddresses[0]?.emailAddress}</span>
              <SignOutButton>
                <button className="nav-btn">Sign Out</button>
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="nav-btn">Sign In</Link>
              <Link href="/sign-up" className="nav-btn nav-btn-primary">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      <div className="container">
        <h1>DSA Interview Platform</h1>
        <p>Select a difficulty level to generate your question.</p>

        {/* Show a welcome message if logged in */}
        {user && <p className="welcome-text">Welcome back, {user.firstName}! 🎉</p>}

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

        {user && (
          <p className="history-hint">
            <Link href="/history">View your past interviews →</Link>
          </p>
        )}
      </div>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
        }
        /* ── Navbar ── */
        .navbar {
          width: 100%;
          max-width: 1200px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.2rem 2rem;
        }
        .nav-brand {
          font-weight: 700;
          font-size: 1.1rem;
          color: #111;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .nav-link {
          text-decoration: none;
          color: #555;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-link:hover { color: #0070f3; }
        .nav-user {
          font-size: 0.9rem;
          color: #555;
        }
        .nav-btn {
          padding: 0.45rem 1rem;
          font-size: 0.9rem;
          border: 1.5px solid #ddd;
          background: white;
          color: #444;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
        }
        .nav-btn:hover {
          border-color: #0070f3;
          color: #0070f3;
        }
        .nav-btn-primary {
          background: #0070f3;
          border-color: #0070f3;
          color: white;
        }
        .nav-btn-primary:hover {
          background: #0060df;
          border-color: #0060df;
          color: white;
        }
        /* ── Main Card ── */
        .container {
          background: white;
          width: 100%;
          max-width: 500px;
          padding: 3rem;
          text-align: center;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
          margin-top: 2rem;
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
        .history-hint {
          margin-top: 1.5rem;
          margin-bottom: 0;
          font-size: 0.9rem;
          color: #888;
        }
        .history-hint a {
          color: #0070f3;
          text-decoration: none;
          font-weight: 500;
        }
        .history-hint a:hover { text-decoration: underline; }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}