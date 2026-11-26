import { Router } from 'express';
import { getAdminDashboard } from '../controllers/dashboard.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/admin', requireAuth, requireCompanyContext(), asyncHandler(getAdminDashboard));

export default router;
