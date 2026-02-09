import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

// Define the shape of the data we expect from the backend
interface EvaluationResult {
  score: number;
  feedback: string;
  // Optional fields (in case older data doesn't have them)
  verdict?: string;
  improvements?: string[];
  strengths?: string[];
}

export default function ReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    // ✅ FIXED: Use GET instead of POST to fetch data
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    
    axios.get(`${apiUrl}/api/interview/${sessionId}`)
      .then(response => {
        setEvaluation(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load report:', err);
        setError('Report not found or failed to load.');
        setLoading(false);
      });
  }, [sessionId]);

  // --- 1. Loading State ---
  if (loading) {
    return (
      <div className="center-screen">
        <div className="loader"></div>
        <p>Loading Report...</p>
        <style jsx>{`
          .center-screen {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #000;
            color: white;
          }
          .loader {
            border: 4px solid #333;
            border-top: 4px solid #a855f7;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // --- 2. Error State ---
  if (error || !evaluation) {
    return (
      <div className="center-screen">
        <h2 className="text-red-500 mb-4">{error || 'Report not found'}</h2>
        <button onClick={() => router.push('/')} className="primary-btn">
          Back to Home
        </button>
        <style jsx>{`
          .center-screen {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #000;
            color: white;
          }
          .primary-btn {
            background: #a855f7;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  // Helper to determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80'; // Green
    if (score >= 50) return '#facc15'; // Yellow
    return '#f87171'; // Red
  };

  // --- 3. Success State (The Report) ---
  return (
    <div className="report-container">
      <h1>Interview Report</h1>

      <div className="overall-score">
        <div className="score-circle" style={{ borderColor: getScoreColor(evaluation.score) }}>
          <div className="score-value">{evaluation.score}</div>
          <div className="score-label">Score</div>
        </div>
        
        {/* If 'verdict' exists, show it, otherwise show generic text based on score */}
        <div className="verdict" style={{ backgroundColor: getScoreColor(evaluation.score) + '20', color: getScoreColor(evaluation.score) }}>
          {evaluation.verdict || (evaluation.score >= 70 ? 'Passed' : 'Needs Improvement')}
        </div>
      </div>

      <div className="report-sections">
        {/* Feedback Section */}
        <section className="card">
          <h2>📝 Feedback</h2>
          <p>{evaluation.feedback}</p>
        </section>

        {/* Improvements Section (Only shows if array exists) */}
        {evaluation.improvements && evaluation.improvements.length > 0 && (
          <section className="card">
            <h2>🚀 Areas for Improvement</h2>
            <ul>
              {evaluation.improvements.map((imp, idx) => (
                <li key={idx}>{imp}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="actions">
        <Link href="/" className="home-button">
          ← Back to Dashboard
        </Link>
      </div>

      <style jsx>{`
        .report-container {
          min-height: 100vh;
          background: #000;
          color: white;
          padding: 2rem;
          font-family: sans-serif;
        }
        h1 {
          text-align: center;
          margin-bottom: 3rem;
          font-size: 2.5rem;
          background: linear-gradient(to right, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .overall-score {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 3rem;
        }
        .score-circle {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          border: 8px solid #333;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #111;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.2);
          margin-bottom: 1.5rem;
        }
        .score-value {
          font-size: 3.5rem;
          font-weight: 800;
        }
        .score-label {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #888;
        }
        .verdict {
          padding: 0.5rem 1.5rem;
          border-radius: 20px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .report-sections {
          max-width: 800px;
          margin: 0 auto;
          display: grid;
          gap: 2rem;
        }
        .card {
          background: #111;
          padding: 2rem;
          border-radius: 12px;
          border: 1px solid #333;
        }
        h2 {
          color: #e0e0e0;
          margin-top: 0;
          border-bottom: 1px solid #333;
          padding-bottom: 1rem;
          margin-bottom: 1rem;
        }
        p {
          color: #a0a0a0;
          line-height: 1.6;
        }
        ul {
          list-style: none;
          padding: 0;
        }
        li {
          padding: 0.8rem 0;
          border-bottom: 1px solid #222;
          color: #a0a0a0;
        }
        li:before {
          content: "•";
          color: #a855f7;
          font-weight: bold;
          display: inline-block;
          width: 1em;
          margin-left: -1em;
        }
        .actions {
          text-align: center;
          margin-top: 3rem;
        }
        .home-button {
          display: inline-block;
          padding: 1rem 2rem;
          background: #333;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .home-button:hover {
          background: #444;
        }
      `}</style>
    </div>
  );
}