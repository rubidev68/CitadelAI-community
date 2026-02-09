import { Request, Response, NextFunction } from 'express';

// No-Op Middleware for Community Edition
export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => next();
export const checkChatbotLimit = async (req: Request, res: Response, next: NextFunction) => next();
export const checkUserAccessLimit = async (req: Request, res: Response, next: NextFunction) => next();
export const checkMessageLimit = async (req: Request, res: Response, next: NextFunction) => next();
export const checkIndexedPagesLimit = async (req: Request, res: Response, next: NextFunction) => next();
export const addSubscriptionInfo = async (req: Request, res: Response, next: NextFunction) => next();
