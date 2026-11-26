import { Router } from 'express';
import {
  createReview,
  listProductReviews,
  moderateReview,
} from '../controllers/community.controller.js';
import { requireAuth, requireCompanyContext, requireRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/product/:productId', asyncHandler(listProductReviews));
router.get('/', requireAuth, requireCompanyContext(), asyncHandler(listProductReviews));
router.post('/', requireAuth, requireRoles('customer'), asyncHandler(createReview));
router.patch('/:id/moderate', requireAuth, requireCompanyContext(), asyncHandler(moderateReview));

export default router;
