import { Router } from 'express';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCompanyCustomers,
  listCustomerAddresses,
} from '../controllers/community.controller.js';
import { requireAuth, requireCompanyContext, requireRoles } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/addresses', requireAuth, requireRoles('customer'), asyncHandler(listCustomerAddresses));
router.post('/addresses', requireAuth, requireRoles('customer'), asyncHandler(createCustomerAddress));
router.delete('/addresses/:id', requireAuth, requireRoles('customer'), asyncHandler(deleteCustomerAddress));
router.get('/', requireAuth, requireCompanyContext(), asyncHandler(listCompanyCustomers));

export default router;
