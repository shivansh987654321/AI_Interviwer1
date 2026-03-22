import { Request, Response, NextFunction } from 'express';

/**
 * Minimal Bearer-token auth guard.
 * Extend this to verify Clerk JWTs server-side once
 * @clerk/backend is added as a dependency.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
    return;
  }
  // TODO: verify Clerk JWT here and attach verified userId to req
  // const { sub } = await clerkClient.verifyToken(authHeader.slice(7));
  // (req as AuthRequest).userId = sub;
  next();
}
