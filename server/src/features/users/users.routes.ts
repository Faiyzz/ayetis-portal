import { ROLES, ROLE_LABELS, ALL_ROLES } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { PERMISSIONS } from '@ayetis/shared';

const router = Router();

/**
 * Exposes system role metadata for authenticated clients.
 * Useful for admin UIs when assigning roles later.
 */
router.get('/roles', authenticate, requirePermission(PERMISSIONS.USER_LIST), (_req, res) => {
  res.json({
    success: true,
    data: ALL_ROLES.map((role) => ({
      value: role,
      label: ROLE_LABELS[role],
      isPublicRegister: role === ROLES.DOCTOR,
    })),
  });
});

export default router;
