import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import interviewRoutes from './routes/interview.routes';

dotenv.config();

const app: Express = express();

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===============================
// MOUNT ROUTES
// ===============================
// This connects your interview routes to the /api/interview URL
app.use('/api/interview', interviewRoutes);

console.log('✅ Routes mounted: /api/interview');

// ===============================
// ERROR HANDLING
// ===============================
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;