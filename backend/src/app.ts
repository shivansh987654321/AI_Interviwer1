import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import interviewRoutes from './routes/interview.routes';

dotenv.config();

const app: Express = express();

// ===============================
// SECURITY HEADERS
// ===============================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow audio/binary responses
}));

// ===============================
// RATE LIMITING
// ===============================
// Global: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// Strict limiter for expensive AI endpoints (20 req/min per IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI endpoint rate limit exceeded. Please slow down.' },
});
app.use('/api/interview/tts', aiLimiter);
app.use('/api/interview/stt', aiLimiter);
app.use('/api/interview/create', aiLimiter);

// ===============================
// CORS
// ===============================
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001']
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===============================
// MOUNT ROUTES
// ===============================
app.use('/api/interview', interviewRoutes);

console.log('✅ Routes mounted: /api/interview');

// ===============================
// ERROR HANDLING
// ===============================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
