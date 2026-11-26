import { Router } from 'express';
import { downloadInvoicePdf, listInvoices } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(listInvoices));
router.get('/:id/pdf', asyncHandler(downloadInvoicePdf));

export default router;
