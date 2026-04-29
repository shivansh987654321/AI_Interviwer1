import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import interviewRoutes from './routes/interview.routes';
import userRoutes from './routes/user.routes';

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
// Global: configurable (default 1000) requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ===============================
// CORS
// ===============================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    // Allow any Vercel preview/production URL
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Clerk — populates req.auth on every request (does NOT enforce auth by itself)
app.use(clerkMiddleware());

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Probes which language runtimes are actually installed on this server.
// Frontend calls this once on load to disable unavailable languages.
import { execSync } from 'child_process';
app.get('/health/langs', (req: Request, res: Response) => {
  const probe = (cmd: string) => { try { execSync(cmd, { stdio: 'ignore', timeout: 3000 }); return true; } catch { return false; } };
  res.json({
    javascript: true,                         // node is always available (we're running on it)
    python:     probe('python3 --version'),
    java:       probe('javac -version'),
    cpp:        probe('g++ --version'),
  });
});

// ===============================
// MOUNT ROUTES
// ===============================
app.use('/api/interview', interviewRoutes);
app.use('/api/user', userRoutes);

console.log('✅ Routes mounted: /api/interview, /api/user');

// ===============================
// ERROR HANDLING
// ===============================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
