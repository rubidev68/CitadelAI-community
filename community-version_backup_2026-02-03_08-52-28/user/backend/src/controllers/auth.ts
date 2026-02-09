import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const JWT_SECRET = config.JWT_SECRET;

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Claim pending chatbot accesses
    const pendingAccesses = await prisma.chatbotAccess.findMany({
      where: {
        userEmail: user.email,
        userId: null,
      },
    });
    for (const access of pendingAccesses) {
      await prisma.chatbotAccess.update({
        where: {
          id: access.id,
        },
        data: {
          userId: user.id,
        },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, user });
  } catch {
    res.status(400).json({ error: 'User already exists' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user });
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const logout = (req: Request, res: Response) => {
  // For simple JWT, logout is handled client-side by deleting the token.
  // This endpoint is here for completeness.
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(user);
  } catch (error) {
    logger.error('Error in auth controller', error instanceof Error ? error : undefined, {
      service: 'auth-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
};
