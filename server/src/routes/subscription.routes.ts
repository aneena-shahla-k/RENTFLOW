import { Router } from 'express';
import {
  changeSubscriptionPlan,
  getSubscriptionStatus,
} from '../controllers/subscription.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, requireCompanyContext());
router.get('/', asyncHandler(getSubscriptionStatus));
router.post('/change-plan', asyncHandler(changeSubscriptionPlan));

export default router;
