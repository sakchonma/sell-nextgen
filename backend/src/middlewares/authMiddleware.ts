import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Users } from '../models/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Verify JWT and attach user to request
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await Users().findOne({ _id: payload.userId } as any);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    // Attach user to request for downstream handlers
    (req as any).user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper to enforce minimum rank (e.g., 5 for Exec)
export const requireRank = (minRank: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.rank < minRank) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
