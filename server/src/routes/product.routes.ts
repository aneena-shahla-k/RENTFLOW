import { Router } from 'express';
import {
  addMaintenancePeriod,
  bulkUpdateProductStatus,
  cancelMaintenancePeriod,
  createProduct,
  deleteProduct,
  getProductAvailabilityOverview,
  getProductById,
  listAdminProducts,
  listPublicProducts,
  updateProduct,
  uploadProductImages,
} from '../controllers/product.controller.js';
import { optionalAuth, requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { uploadMiddleware } from '../services/storage.service.js';
import { asyncHandler } from '../utils/errors.js';
import {
  bulkProductStatusSchema,
  createMaintenanceSchema,
  createProductSchema,
  updateProductSchema,
} from '../validators/inventory.validator.js';

const router = Router();

router.get('/public', asyncHandler(listPublicProducts));
router.get('/public/:id', optionalAuth, asyncHandler(getProductById));

router.get('/', requireAuth, requireCompanyContext(), asyncHandler(listAdminProducts));
router.post('/', requireAuth, requireCompanyContext(), validateBody(createProductSchema), asyncHandler(createProduct));
router.post('/bulk-status', requireAuth, requireCompanyContext(), validateBody(bulkProductStatusSchema), asyncHandler(bulkUpdateProductStatus));
router.post('/upload-images', requireAuth, requireCompanyContext(), uploadMiddleware.array('images', 6), asyncHandler(uploadProductImages));

router.get('/:id', optionalAuth, asyncHandler(getProductById));
router.patch('/:id', requireAuth, requireCompanyContext(), validateBody(updateProductSchema), asyncHandler(updateProduct));
router.delete('/:id', requireAuth, requireCompanyContext(), asyncHandler(deleteProduct));

router.get('/:id/availability', requireAuth, requireCompanyContext(), asyncHandler(getProductAvailabilityOverview));
router.post('/:id/maintenance', requireAuth, requireCompanyContext(), validateBody(createMaintenanceSchema), asyncHandler(addMaintenancePeriod));
router.delete('/:id/maintenance/:periodId', requireAuth, requireCompanyContext(), asyncHandler(cancelMaintenancePeriod));

export default router;
