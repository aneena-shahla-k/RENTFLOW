import { Router } from 'express';
import {
  getSuperAdminOverview,
  listAllCompanies,
  listPlatformSupportTickets,
  updateCompanyStatus,
  updateCompanySubscriptionByAdmin,
} from '../controllers/superadmin.controller.js';
import { requireAuth, requireRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, requireRoles('super_admin'));
router.get('/overview', asyncHandler(getSuperAdminOverview));
router.get('/companies', asyncHandler(listAllCompanies));
router.patch('/companies/:id/status', asyncHandler(updateCompanyStatus));
router.patch('/companies/:id/subscription', asyncHandler(updateCompanySubscriptionByAdmin));
router.get('/support', asyncHandler(listPlatformSupportTickets));

export default router;
