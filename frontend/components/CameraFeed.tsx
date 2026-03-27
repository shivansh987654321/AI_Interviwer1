// components/AnswerInput.tsx
import { useState, useRef, useEffect } from 'react';

interface AnswerInputProps {
  questionId: string;
  onSubmit: (answer: string) => void;
}

export default function AnswerInput({ questionId, onSubmit }: AnswerInputProps) {
  const [answer, setAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t + ' ';
          } else {
            interimTranscript += t;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
        setAnswer(finalTranscript + interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }

    // FIX: Stop the mic when this component is removed from the page.
    // Without this the browser keeps the mic on in the background.
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Reset answer when the question changes
  useEffect(() => {
    setAnswer('');
    setTranscript('');
  }, [questionId]);

  const startRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer);
      setAnswer('');
      setTranscript('');
    }
  };

  return (
    <div className="answer-input-container">
      <div className="input-header">
        <h3>Your Answer</h3>
        <div className="input-actions">
          <button
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            type="button"
          >
            {isRecording ? '⏹ Stop' : '🎤 Record'}
          </button>
        </div>
      </div>

      <textarea
        className="answer-textarea"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer or use voice input..."
        rows={8}
      />

      {transcript && (
        <div className="transcript-preview">
          <small>Voice input: {transcript}</small>
        </div>
      )}

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={!answer.trim()}
      >
        Submit Answer
      </button>

      <style jsx>{`
        .answer-input-container {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .input-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .input-actions {
          display: flex;
          gap: 0.5rem;
        }
        .record-button {
          padding: 0.5rem 1rem;
          border: 2px solid #0070f3;
          background: white;
          color: #0070f3;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .record-button.recording {
          background: #ff6b6b;
          color: white;
          border-color: #ff6b6b;
        }
        .answer-textarea {
          width: 100%;
          padding: 1rem;
          border: 2px solid #e0e0e0;
          border-radius: 4px;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 0.5rem;
        }
        .answer-textarea:focus {
          outline: none;
          border-color: #0070f3;
        }
        .transcript-preview {
          padding: 0.5rem;
          background: #f0f0f0;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #666;
        }
        .submit-button {
          width: 100%;
          padding: 1rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .submit-button:hover:not(:disabled) {
          background: #0051cc;
        }
        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}