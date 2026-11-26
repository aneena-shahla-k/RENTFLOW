import { Router } from 'express';
import {
  cancelBooking,
  checkAvailability,
  createBooking,
  getBookingById,
  handleBookingExtension,
  listBookings,
  updateBookingStatus,
} from '../controllers/booking.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/errors.js';
import {
  cancelBookingSchema,
  checkAvailabilitySchema,
  createBookingSchema,
  extensionSchema,
  updateBookingStatusSchema,
} from '../validators/booking.validator.js';

const router = Router();

router.post('/check-availability', validateBody(checkAvailabilitySchema), asyncHandler(checkAvailability));
router.post('/', requireAuth, validateBody(createBookingSchema), asyncHandler(createBooking));
router.get('/', requireAuth, asyncHandler(listBookings));
router.get('/:id', requireAuth, asyncHandler(getBookingById));
router.patch(
  '/:id/status',
  requireAuth,
  requireCompanyContext(),
  validateBody(updateBookingStatusSchema),
  asyncHandler(updateBookingStatus)
);
router.post('/:id/cancel', requireAuth, validateBody(cancelBookingSchema), asyncHandler(cancelBooking));
router.post('/:id/extension', requireAuth, validateBody(extensionSchema), asyncHandler(handleBookingExtension));

export default router;
