import { Router } from 'express';
import {
  createSupportTicket,
  listSupportTickets,
  replySupportTicket,
  updateSupportTicket,
} from '../controllers/community.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { uploadMiddleware } from '../services/storage.service.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, optionalAuth);
router.get('/', asyncHandler(listSupportTickets));
router.post('/', uploadMiddleware.single('attachment'), asyncHandler(createSupportTicket));
router.post('/:id/reply', asyncHandler(replySupportTicket));
router.patch('/:id', asyncHandler(updateSupportTicket));

export default router;
