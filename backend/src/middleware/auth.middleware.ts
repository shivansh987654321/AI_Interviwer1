import { getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';

// clerkMiddleware() in app.ts populates the auth state on every request.
// getAuth(req) returns the resolved AuthObject — never redirects, always returns 401 JSON.
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. Valid Clerk session required.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized. Valid Clerk session required.' });
  }
};
