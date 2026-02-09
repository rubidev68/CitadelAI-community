
import { Router } from 'express';
import { getChatbots, setDefaultChatbot, getChatbotById } from '../controllers/chatbot';
import { authMiddleware as auth } from '../middleware/auth';
import { validateRequest } from '@shared/utils';
import {
  getChatbotByIdSchema,
  setDefaultChatbotSchema,
} from '../validation/chatbotSchemas';

const router = Router();

router.get('/', auth, getChatbots);
router.get('/:id', auth, validateRequest(getChatbotByIdSchema) as any, getChatbotById);
router.post('/:chatbotId/set-default', auth, validateRequest(setDefaultChatbotSchema) as any, setDefaultChatbot);

export default router;
