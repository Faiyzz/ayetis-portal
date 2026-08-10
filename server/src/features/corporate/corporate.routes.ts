import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requireAnyPermission, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as corporateController from './corporate.controller';
import {
  createEmployeeSchema,
  createFacilitySchema,
  createSubAccountSchema,
  employeeStatusSchema,
  updateFacilitySchema,
  updateOrganizationSchema,
  verifySubAccountSchema,
} from './corporate.schemas';

const router = Router();

router.post(
  '/subaccounts/verify',
  validate(verifySubAccountSchema),
  corporateController.verifySubAccount,
);
router.get('/subaccounts/verify', corporateController.verifySubAccount);

router.use(authenticate);

router.get(
  '/dashboard',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_ORG,
    PERMISSIONS.ORG_MANAGE_SELF,
    PERMISSIONS.FACILITY_MANAGE,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
  corporateController.dashboard,
);

router.get(
  '/organizations',
  requirePermission(PERMISSIONS.CASE_VIEW_ALL),
  corporateController.listOrganizations,
);

router.get(
  '/organization',
  requireAnyPermission(PERMISSIONS.ORG_MANAGE_SELF, PERMISSIONS.CASE_VIEW_ALL),
  corporateController.getOrganization,
);

router.patch(
  '/organization',
  requireAnyPermission(PERMISSIONS.ORG_MANAGE_SELF, PERMISSIONS.CASE_VIEW_ALL),
  validate(updateOrganizationSchema),
  corporateController.updateOrganization,
);

router.get(
  '/facilities',
  requireAnyPermission(
    PERMISSIONS.FACILITY_MANAGE,
    PERMISSIONS.EMPLOYEE_MANAGE,
    PERMISSIONS.SUBACCOUNT_MANAGE,
    PERMISSIONS.CASE_VIEW_ORG,
    PERMISSIONS.CASE_VIEW_FACILITY,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
  corporateController.listFacilities,
);

router.post(
  '/facilities',
  requireAnyPermission(PERMISSIONS.FACILITY_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  validate(createFacilitySchema),
  corporateController.createFacility,
);

router.patch(
  '/facilities/:facilityId',
  requireAnyPermission(PERMISSIONS.FACILITY_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  validate(updateFacilitySchema),
  corporateController.updateFacility,
);

router.get(
  '/employees',
  requireAnyPermission(PERMISSIONS.EMPLOYEE_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  corporateController.listEmployees,
);

router.post(
  '/employees',
  requireAnyPermission(PERMISSIONS.EMPLOYEE_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  validate(createEmployeeSchema),
  corporateController.createEmployee,
);

router.patch(
  '/employees/:userId/status',
  requireAnyPermission(PERMISSIONS.EMPLOYEE_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  validate(employeeStatusSchema),
  corporateController.setEmployeeStatus,
);

router.get(
  '/subaccounts',
  requireAnyPermission(PERMISSIONS.SUBACCOUNT_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  corporateController.listSubAccounts,
);

router.post(
  '/subaccounts',
  requireAnyPermission(PERMISSIONS.SUBACCOUNT_MANAGE, PERMISSIONS.CASE_VIEW_ALL),
  validate(createSubAccountSchema),
  corporateController.createSubAccount,
);

export default router;
