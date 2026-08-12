import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as authController from './auth.controller';
import {
  changePasswordSchema,
  confirmPasswordResetSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updatePreferencesSchema,
  verifyEmailSchema,
} from './auth.schemas';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
});

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.get('/verify-email', authLimiter, authController.verifyEmail);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  '/confirm-password-reset',
  authLimiter,
  validate(confirmPasswordResetSchema),
  authController.confirmPasswordReset,
);
router.get('/confirm-password-reset', authLimiter, authController.confirmPasswordReset);
router.get('/me', authenticate, authController.me);
router.patch(
  '/preferences',
  authenticate,
  validate(updatePreferencesSchema),
  authController.updatePreferences,
);
router.post('/logout', authenticate, authController.logout);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
