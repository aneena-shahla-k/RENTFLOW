import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../controllers/category.controller.js';
import { optionalAuth, requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/errors.js';
import { createCategorySchema, updateCategorySchema } from '../validators/inventory.validator.js';

const router = Router();

router.get('/public', optionalAuth, asyncHandler(listCategories));
router.get('/', requireAuth, requireCompanyContext(), asyncHandler(listCategories));
router.post('/', requireAuth, requireCompanyContext(), validateBody(createCategorySchema), asyncHandler(createCategory));
router.patch('/:id', requireAuth, requireCompanyContext(), validateBody(updateCategorySchema), asyncHandler(updateCategory));
router.delete('/:id', requireAuth, requireCompanyContext(), asyncHandler(deleteCategory));

export default router;
