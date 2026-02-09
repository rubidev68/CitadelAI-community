import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { config } from '../config';

const JWT_SECRET = config.JWT_SECRET;

export interface AdminAuthRequest extends Request {
  adminUser?: { id: string; email: string };
}

export const adminAuthMiddleware = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const adminUser = await prisma.adminUser.findUnique({ where: { id: decoded.id } });

    if (!adminUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.adminUser = { id: adminUser.id, email: adminUser.email };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
