import { Router } from 'express';
import {
  createCompany,
  getMyCompany,
  listPublicCompanies,
  updateMyCompany,
  uploadCompanyLogo,
} from '../controllers/company.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { uploadMiddleware } from '../services/storage.service.js';
import { asyncHandler } from '../utils/errors.js';
import { createCompanySchema, updateCompanySchema } from '../validators/company.validator.js';

const router = Router();

router.get('/public', asyncHandler(listPublicCompanies));
router.post('/', requireAuth, validateBody(createCompanySchema), asyncHandler(createCompany));
router.get('/me', requireAuth, requireCompanyContext({ allowSuspended: true }), asyncHandler(getMyCompany));
router.patch(
  '/me',
  requireAuth,
  requireCompanyContext(),
  validateBody(updateCompanySchema),
  asyncHandler(updateMyCompany)
);
router.post(
  '/me/logo',
  requireAuth,
  requireCompanyContext(),
  uploadMiddleware.single('logo'),
  asyncHandler(uploadCompanyLogo)
);

export default router;
