import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as usersController from './users.controller';
import {
  assignPermissionsSchema,
  createUserSchema,
  updateUserSchema,
} from './users.schemas';

const router = Router();

router.use(authenticate);

router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ROLE_VIEW_PERMISSIONS),
  usersController.listPermissions,
);

router.get(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_VIEW_PERMISSIONS),
  usersController.listRoles,
);

router.get(
  '/roles/:role',
  requirePermission(PERMISSIONS.ROLE_VIEW_PERMISSIONS),
  usersController.getRole,
);

router.put(
  '/roles/:role/permissions',
  requirePermission(PERMISSIONS.ROLE_ASSIGN_PERMISSIONS),
  validate(assignPermissionsSchema),
  usersController.updateRolePermissions,
);

router.get('/', requirePermission(PERMISSIONS.USER_LIST), usersController.listUsers);

router.post(
  '/',
  requirePermission(PERMISSIONS.USER_CREATE),
  validate(createUserSchema),
  usersController.createUser,
);

router.get('/:userId', requirePermission(PERMISSIONS.USER_LIST), usersController.getUser);

router.patch(
  '/:userId',
  requirePermission(PERMISSIONS.USER_UPDATE),
  validate(updateUserSchema),
  usersController.updateUser,
);

router.put(
  '/:userId/permissions',
  requirePermission(PERMISSIONS.USER_ASSIGN_PERMISSIONS),
  validate(assignPermissionsSchema),
  usersController.updateUserPermissions,
);

router.delete(
  '/:userId',
  requirePermission(PERMISSIONS.USER_DELETE),
  usersController.deleteUser,
);

export default router;
