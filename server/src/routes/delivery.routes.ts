import { Router } from 'express';
import { listDeliveries, updateDelivery } from '../controllers/delivery.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listDeliveries));
router.patch('/:id', requireAuth, requireCompanyContext(), asyncHandler(updateDelivery));

export default router;
