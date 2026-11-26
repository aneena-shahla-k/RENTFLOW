import { Router } from 'express';
import {
  createPaymentOrder,
  generateDevSimulatedPaymentPayload,
  handlePaymentWebhook,
  listPayments,
  verifyPayment,
} from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.post('/webhook', asyncHandler(handlePaymentWebhook));
router.post('/create-order', requireAuth, asyncHandler(createPaymentOrder));
router.post('/dev-simulate-signature', requireAuth, asyncHandler(generateDevSimulatedPaymentPayload));
router.post('/verify', requireAuth, asyncHandler(verifyPayment));
router.get('/', requireAuth, asyncHandler(listPayments));

export default router;
