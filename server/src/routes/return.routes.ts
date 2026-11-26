import { Router } from 'express';
import { listReturns, processReturn, updateReturn } from '../controllers/return.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, requireCompanyContext());
router.post('/', asyncHandler(processReturn));
router.get('/', asyncHandler(listReturns));
router.patch('/:id', asyncHandler(updateReturn));

export default router;
