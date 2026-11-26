import { Router } from 'express';
import {
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  updateProfile,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/errors.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerUnifiedSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validateBody(registerUnifiedSchema), asyncHandler(register));
router.post('/login', validateBody(loginSchema), asyncHandler(login));
router.post('/refresh', validateBody(refreshSchema), asyncHandler(refresh));
router.post('/logout', optionalAuth, asyncHandler(logout));
router.post('/forgot-password', validateBody(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password', validateBody(resetPasswordSchema), asyncHandler(resetPassword));
router.post('/verify-email', validateBody(verifyEmailSchema), asyncHandler(verifyEmail));
router.get('/me', requireAuth, asyncHandler(getMe));
router.patch('/profile', requireAuth, validateBody(updateProfileSchema), asyncHandler(updateProfile));

export default router;
