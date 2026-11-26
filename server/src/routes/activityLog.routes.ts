import { Router } from 'express';
import { listActivityLogs } from '../controllers/community.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', requireAuth, requireCompanyContext(), asyncHandler(listActivityLogs));

export default router;
