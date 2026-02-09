import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiter';
import { validateRequest } from '@shared/utils';
import {
  registerSchema,
  loginSchema,
} from '../validation/authSchemas';

const router = Router();

router.post('/register', authRateLimit, validateRequest(registerSchema) as any, register);
router.post('/login', authRateLimit, validateRequest(loginSchema) as any, login);
router.post('/logout', authRateLimit, logout);
router.get('/me', authMiddleware, getMe);

export default router;
