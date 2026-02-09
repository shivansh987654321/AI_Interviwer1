interface QuestionCardProps {
  question: {
    id: string;
    text: string;
    type: string;
    difficulty: string;
    maxScore: number;
    timeLimit?: number;
  };
}

export default function QuestionCard({ question }: QuestionCardProps) {
  return (
    <div className="question-card">
      <div className="question-header">
        <span className="question-type">{question.type}</span>
        <span className="question-difficulty">{question.difficulty}</span>
        {question.timeLimit && (
          <span className="question-timer">
            {Math.floor(question.timeLimit / 60)}:{(question.timeLimit % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="question-text">{question.text}</div>
      <div className="question-footer">
        Max Score: {question.maxScore}
      </div>

      <style jsx>{`
        .question-card {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .question-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        .question-type,
        .question-difficulty {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          background: #f0f0f0;
          font-weight: 600;
        }
        .question-timer {
          margin-left: auto;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          background: #ff6b6b;
          color: white;
          font-weight: 600;
        }
        .question-text {
          font-size: 1.2rem;
          line-height: 1.6;
          color: #333;
          margin-bottom: 1rem;
        }
        .question-footer {
          font-size: 0.9rem;
          color: #666;
        }
      `}</style>
    </div>
  );
}
