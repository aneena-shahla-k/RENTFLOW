import { Router } from 'express';
import {
  inviteStaff,
  listStaff,
  removeStaff,
  updateStaff,
} from '../controllers/company.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/errors.js';
import { inviteStaffSchema, updateStaffSchema } from '../validators/company.validator.js';

const router = Router();

router.use(requireAuth, requireCompanyContext());

router.get('/', asyncHandler(listStaff));
router.post('/', validateBody(inviteStaffSchema), asyncHandler(inviteStaff));
router.patch('/:id', validateBody(updateStaffSchema), asyncHandler(updateStaff));
router.delete('/:id', asyncHandler(removeStaff));

export default router;
