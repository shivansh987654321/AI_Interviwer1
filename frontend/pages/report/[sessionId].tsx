import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface EvaluationResult {
  score: number;
  verdict: string;
  feedback: string;
  improvements: string[];
}

export default function ReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/interview/complete/${sessionId}`)
      .then(response => {
        setEvaluation(response.data.evaluation);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load report:', error);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="loading">
        <div>Loading report...</div>
        <style jsx>{`
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 1.2rem;
            color: #666;
          }
        `}</style>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="error">
        <div>Report not found</div>
        <button onClick={() => router.push('/')} className="home-button">
          Back to Home
        </button>
        <style jsx>{`
          .error {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 1.2rem;
            color: #666;
          }
          .home-button {
            margin-top: 1rem;
            padding: 0.75rem 2rem;
            background: #0070f3;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="report-container">
      <h1>Interview Report</h1>

      <div className="overall-score">
        <div className="score-circle">
          <div className="score-value">{evaluation.score}</div>
          <div className="score-label">Score</div>
        </div>
        <div className={`verdict verdict-${evaluation.verdict.toLowerCase().replace(/\s+/g, '-')}`}>
          {evaluation.verdict}
        </div>
      </div>

      <div className="report-sections">
        <section className="feedback-section">
          <h2>Feedback</h2>
          <p>{evaluation.feedback}</p>
        </section>

        {evaluation.improvements && evaluation.improvements.length > 0 && (
          <section className="improvements-section">
            <h2>Improvements</h2>
            <ul>
              {evaluation.improvements.map((imp, idx) => (
                <li key={idx}>{imp}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <button onClick={() => router.push('/')} className="home-button">
        Back to Home
      </button>

      <style jsx>{`
        .report-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        .overall-score {
          text-align: center;
          margin: 2rem 0;
        }
        .score-circle {
          display: inline-block;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 1rem;
        }
        .score-value {
          font-size: 3rem;
          font-weight: bold;
        }
        .score-label {
          font-size: 1rem;
          opacity: 0.9;
        }
        .verdict {
          font-size: 1.5rem;
          font-weight: 600;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          display: inline-block;
          margin-top: 1rem;
        }
        .verdict-accepted {
          color: #00b8a3;
          background: #e6f7f5;
        }
        .verdict-wrong-answer {
          color: #ff6b6b;
          background: #ffe6e6;
        }
        .verdict-compilation-error {
          color: #ff9800;
          background: #fff3e0;
        }
        .verdict-time-limit-exceeded {
          color: #9c27b0;
          background: #f3e5f5;
        }
        .verdict-runtime-error {
          color: #f44336;
          background: #ffebee;
        }
        .verdict-rejected {
          color: #d32f2f;
          background: #ffebee;
        }
        .report-sections {
          display: grid;
          gap: 2rem;
          margin: 2rem 0;
        }
        section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        p {
          color: #666;
          line-height: 1.6;
        }
        ul {
          list-style: none;
          padding: 0;
        }
        li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #e0e0e0;
          color: #666;
        }
        .home-button {
          display: block;
          margin: 2rem auto;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
