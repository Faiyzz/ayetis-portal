import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE_STATUSES, DOCTOR_DECISIONS, PERMISSIONS, QC_ERROR_CODES, QC_SCOPES, ROLES } from '@ayetis/shared';
import { AppError } from '../../utils/AppError';

const DOCTOR_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439099';
const DESIGNER_ID = '507f1f77bcf86cd799439014';
const QC_ID = '507f1f77bcf86cd799439015';
const COORD_ID = '507f1f77bcf86cd799439016';

function makeCase(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    _id: DOCTOR_ID,
    id: DOCTOR_ID,
    caseId: 'AYT-1001',
    patientName: 'Jane',
    patientAge: 20,
    doctorId: DOCTOR_ID,
    doctorName: 'Dr Ada',
    doctorDisplayId: 'D-1',
    doctorEmail: 'ada@test.com',
    organizationId: 'org-1',
    facilityId: 'fac-1',
    corporateCustomerId: 'C1',
    status: CASE_STATUSES.NEW_CASE,
    priority: 'normal',
    caseCategory: 'digital_aligner',
    caseType: 'new',
    chiefComplaint: 'crowding',
    treatmentSummary: 'aligners',
    payment: { status: 'paid', currency: 'USD', amountPaid: 100 },
    submittedAt: now,
    slaHours: 48,
    slaDeadlineAt: new Date(now.getTime() + 48 * 3600_000),
    assignedDesignerId: null,
    assignmentMode: 'none',
    cutRequired: false,
    cutPhase: 'none',
    cutAssignmentMode: 'none',
    assignedCutOperatorId: null,
    validatedAt: null,
    consultantIndicator: null,
    isDeleted: false,
    isDemo: false,
    invoiceId: null,
    previousStatus: null,
    statusPendingDoctorAck: false,
    country: 'United States',
    countryId: null,
    regionId: null,
    createdAt: now,
    updatedAt: now,
    clinicName: 'Clinic',
    practiceName: 'Practice',
    patientGender: 'Female',
    patientDateOfBirth: null,
    instructions: '',
    treatmentInstructions: {},
    notes: [],
    files: [],
    history: [],
    cutInternalComments: [],
    clinicalRemarks: [],
    qcReviews: [],
    cutRevisions: [],
    delivery: null,
    doctorDecision: null,
    doctorEngagement: {},
    commercial: { currency: 'USD', finalPayableAmount: 100 },
    prosthoDetails: {},
    implantDetails: {},
    cancelReason: null,
    paymentSessionId: null,
    save: vi.fn(async function save(this: unknown) {
      return this;
    }),
    ...overrides,
  };
}

function doctorActor(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCTOR_ID,
    email: 'ada@test.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: ROLES.DOCTOR,
    permissions: [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_VIEW_OWN, PERMISSIONS.CASE_APPROVE],
    qcScope: QC_SCOPES.NONE,
    ...overrides,
  };
}

function coordinatorActor() {
  return {
    id: COORD_ID,
    email: 'co@test.com',
    firstName: 'Cora',
    lastName: 'Dinator',
    role: ROLES.COORDINATOR,
    permissions: [
      PERMISSIONS.CASE_VALIDATE,
      PERMISSIONS.CASE_ASSIGN,
      PERMISSIONS.CASE_VIEW_ALL,
    ],
    qcScope: QC_SCOPES.NONE,
  };
}

function designerActor() {
  return {
    id: DESIGNER_ID,
    email: 'des@test.com',
    firstName: 'Des',
    lastName: 'Ign',
    role: ROLES.DESIGNER,
    permissions: [PERMISSIONS.CASE_DESIGN, PERMISSIONS.CASE_VIEW_ASSIGNED],
    qcScope: QC_SCOPES.NONE,
  };
}

function qcActor() {
  return {
    id: QC_ID,
    email: 'qc@test.com',
    firstName: 'Quinn',
    lastName: 'Chen',
    role: ROLES.QC,
    permissions: [PERMISSIONS.CASE_QC_REVIEW, PERMISSIONS.CASE_VIEW_ALL],
    qcScope: QC_SCOPES.ALL,
  };
}

function activeDoctorUser() {
  return {
    _id: DOCTOR_ID,
    id: DOCTOR_ID,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@test.com',
    doctorId: 'D-1',
    role: ROLES.DOCTOR,
    accountStatus: 'active',
    organizationId: null,
    facilityId: null,
    corporateCustomerId: null,
  };
}

const { Case, CancellationAudit, persistUploadedFile, User } = vi.hoisted(() => {
  const chain = (result: unknown[] = []) => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    q.select = vi.fn(self);
    q.sort = vi.fn(self);
    q.lean = vi.fn(self);
    q.skip = vi.fn(self);
    q.limit = vi.fn(self);
    q.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return q;
  };

  function CaseModel(data: Record<string, unknown> = {}) {
    const inst: Record<string, unknown> = {
      ...data,
      id: String(data.caseId ?? 'AYT-9'),
      _id: data._id ?? '507f1f77bcf86cd799439011',
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
      notes: Array.isArray(data.notes) ? [...(data.notes as unknown[])] : [],
      files: Array.isArray(data.files) ? [...(data.files as unknown[])] : [],
      history: Array.isArray(data.history) ? [...(data.history as unknown[])] : [],
      qcReviews: Array.isArray(data.qcReviews) ? [...(data.qcReviews as unknown[])] : [],
    };
    inst.save = vi.fn(async () => inst);
    return inst;
  }
  CaseModel.findOne = vi.fn();
  CaseModel.find = vi.fn(() => chain([]));
  CaseModel.countDocuments = vi.fn(async () => 0);
  CaseModel.updateOne = vi.fn(async () => ({}));

  return {
    Case: CaseModel,
    CancellationAudit: { create: vi.fn() },
    persistUploadedFile: vi.fn(async () => ({ storageKey: 'cases/AYT-1001/scan.stl' })),
    User: {
      find: vi.fn(() => chain([])),
      findById: vi.fn(),
    },
  };
});

vi.mock('../../models/Case', () => ({ Case }));
vi.mock('../../models/User', () => ({ User }));
vi.mock('../../models/CaseCounter', () => ({ generateCaseId: vi.fn(async () => 'AYT-9') }));
vi.mock('../../models/CancellationAudit', () => ({ CancellationAudit }));
vi.mock('../../models/Commercial', () => ({ PaymentSession: { findById: vi.fn() } }));
vi.mock('../clarifications/clarifications.service', () => ({
  countOpenClarifications: vi.fn(async () => 0),
  getClarificationButtonStateForCase: vi.fn(async () => 'none'),
  listClarificationDtosForCase: vi.fn(async () => []),
}));
vi.mock('../notifications/notifications.service', () => ({
  createNotification: vi.fn(),
  createNotificationsForUsers: vi.fn(),
}));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../users/users.service', () => ({
  resolvePermissionsForUserId: vi.fn(async () => []),
  assertCanSubmitWork: vi.fn(async () => ({ id: '507f1f77bcf86cd799439011' })),
}));
vi.mock('../settings/settings.service', () => ({
  resolveSlaHoursForUser: vi.fn(async () => 48),
}));
vi.mock('../settings/geoResolve', () => ({
  resolveCountryGeo: vi.fn(async () => ({ country: 'United States' })),
}));
vi.mock('../../services/storage.service', () => ({
  persistUploadedFile,
  storedFileExists: vi.fn(async () => true),
}));
vi.mock('../../models/Facility', () => ({
  Facility: {
    find: vi.fn(() => ({ select: vi.fn(async () => []) })),
    findById: vi.fn(),
  },
}));
vi.mock('../commercial/pricingBilling.service', () => ({
  evaluateCreateEligibility: vi.fn(async () => ({
    allowedWithoutPayment: true,
    reason: 'zero_amount',
  })),
  resolveCasePricing: vi.fn(async () => ({
    treatmentPlanId: 'plan-1',
    treatmentPlanName: 'Aligner',
    unitPrice: 0,
    discountCode: '',
    discountAmount: 0,
    finalPayableAmount: 0,
    currency: 'USD',
    isFreeDemoPlan: false,
  })),
  debitPrepaidForCase: vi.fn(),
  redeemDiscountCode: vi.fn(),
}));
vi.mock('../../services/fileLifecycle.service', () => ({
  toLifecycleDto: vi.fn(() => ({
    storageTier: 'hot',
    restoreStatus: 'none',
    hotUntil: null,
    coldSince: null,
    restoreRequestedAt: null,
    restoreError: null,
  })),
  copyLifecycleToDelivery: vi.fn(),
  copyLifecycleToFile: vi.fn(),
  ensureReadableForDownload: vi.fn(),
  initialHotFields: vi.fn(() => ({
    storageTier: 'hot',
    restoreStatus: 'none',
    hotUntil: new Date(),
  })),
  lifecycleFromDelivery: vi.fn(),
  lifecycleFromFile: vi.fn(),
  markCaseModified: vi.fn(),
  startRestore: vi.fn(),
  syncRestoreStatus: vi.fn(),
}));
vi.mock('../../services/archiveExtract.service', () => ({ extractArchiveMembers: vi.fn() }));
vi.mock('../../services/malwareScan.service', () => ({
  scanUploadedFile: vi.fn(async () => ({ status: 'skipped', message: 'off' })),
}));
vi.mock('../../services/email', () => ({
  sendCmsOrFallback: vi.fn(),
  caseEventTemplate: vi.fn(() => ({ subject: 's', html: '' })),
  caseDeliveredTemplate: vi.fn(() => ({ subject: 's', html: '' })),
}));
vi.mock('../cancellations/cancellations.service', () => ({
  summarizeDevice: vi.fn(() => 'Chrome · Linux · Desktop'),
}));

import {
  approveQcCase,
  assignCase,
  cancelCase,
  createCase,
  getCaseById,
  getCoordinatorDashboard,
  getQcDashboard,
  listCases,
  markCaseValidated,
  rejectQcCase,
  recordDoctorCaseView,
  startCaseValidation,
  submitCaseToQc,
  submitDoctorDecision,
  uploadCaseFiles,
} from './cases.service';
import { mockQuery } from '../../test/mocks';

describe('cases.service URD workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Case.find.mockImplementation(() => mockQuery([]));
    Case.countDocuments.mockResolvedValue(0);
  });

  it('forbids creating a case without CASE_CREATE', async () => {
    await expect(
      createCase({ ...doctorActor(), permissions: [PERMISSIONS.CASE_VIEW_OWN] } as never, {
        patientName: 'X',
      } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('hides cases from other doctors', async () => {
    Case.findOne.mockResolvedValue(makeCase());
    await expect(
      getCaseById({ ...doctorActor(), id: OTHER_ID } as never, 'AYT-1001'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets the owning doctor view their case', async () => {
    Case.findOne.mockResolvedValue(makeCase());
    const detail = await getCaseById(doctorActor() as never, 'AYT-1001');
    expect(detail.caseId).toBe('AYT-1001');
    expect(detail.status).toBe(CASE_STATUSES.NEW_CASE);
  });

  it('allows org-scoped corporate admins to view', async () => {
    Case.findOne.mockResolvedValue(makeCase());
    const detail = await getCaseById(
      {
        ...doctorActor(),
        id: OTHER_ID,
        role: ROLES.CORPORATE_ADMIN,
        permissions: [PERMISSIONS.CASE_VIEW_ORG],
        organizationId: 'org-1',
      } as never,
      'AYT-1001',
    );
    expect(detail.caseId).toBe('AYT-1001');
  });

  it('cancels a New Case within 15 minutes', async () => {
    const caseDoc = makeCase();
    Case.findOne.mockResolvedValue(caseDoc);
    CancellationAudit.create.mockResolvedValue({});
    const detail = await cancelCase(doctorActor() as never, 'AYT-1001', 'Submitted in error');
    expect(caseDoc.status).toBe(CASE_STATUSES.CANCELLED);
    expect(detail.status).toBe(CASE_STATUSES.CANCELLED);
    expect(CancellationAudit.create).toHaveBeenCalled();
  });

  it('blocks doctor cancel after the 15-minute window', async () => {
    const caseDoc = makeCase({
      submittedAt: new Date(Date.now() - 16 * 60 * 1000),
    });
    Case.findOne.mockResolvedValue(caseDoc);
    await expect(
      cancelCase(doctorActor() as never, 'AYT-1001', 'too late'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('blocks cancel when status is no longer New Case', async () => {
    Case.findOne.mockResolvedValue(makeCase({ status: CASE_STATUSES.IN_PROCESS }));
    await expect(cancelCase(doctorActor() as never, 'AYT-1001', 'nope')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('records doctor view as engagement', async () => {
    const caseDoc = makeCase({
      status: CASE_STATUSES.WAITING_FOR_APPROVAL,
      doctorEngagement: {},
    });
    Case.findOne.mockResolvedValue(caseDoc);
    await recordDoctorCaseView(doctorActor() as never, 'AYT-1001');
    expect(caseDoc.doctorEngagement.openedAt).toBeInstanceOf(Date);
    expect(caseDoc.save).toHaveBeenCalled();
  });

  it('approves a delivered case', async () => {
    const caseDoc = makeCase({
      status: CASE_STATUSES.WAITING_FOR_APPROVAL,
      doctorEngagement: {},
    });
    Case.findOne.mockResolvedValue(caseDoc);
    const detail = await submitDoctorDecision(doctorActor() as never, 'AYT-1001', {
      decision: DOCTOR_DECISIONS.APPROVE,
    });
    expect(caseDoc.status).toBe(CASE_STATUSES.APPROVED);
    expect(detail.status).toBe(CASE_STATUSES.APPROVED);
  });

  it('requires a note when requesting modification', async () => {
    Case.findOne.mockResolvedValue(
      makeCase({ status: CASE_STATUSES.WAITING_FOR_APPROVAL, doctorEngagement: {} }),
    );
    await expect(
      submitDoctorDecision(doctorActor() as never, 'AYT-1001', {
        decision: DOCTOR_DECISIONS.REQUEST_MODIFICATION,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('sends modification cases back to In Process', async () => {
    const caseDoc = makeCase({
      status: CASE_STATUSES.WAITING_FOR_APPROVAL,
      doctorEngagement: {},
    });
    Case.findOne.mockResolvedValue(caseDoc);
    await submitDoctorDecision(doctorActor() as never, 'AYT-1001', {
      decision: DOCTOR_DECISIONS.REQUEST_MODIFICATION,
      note: 'Please adjust midline',
    });
    expect(caseDoc.status).toBe(CASE_STATUSES.IN_PROCESS);
  });

  it('returns 404 when the case does not exist', async () => {
    Case.findOne.mockResolvedValue(null);
    await expect(getCaseById(doctorActor() as never, 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('saves a draft and submits a new case', async () => {
    User.findById.mockResolvedValue(activeDoctorUser());
    const draft = await createCase(doctorActor() as never, {
      patientName: 'Draft Patient',
      asDraft: true,
    } as never);
    expect(draft.status).toBe(CASE_STATUSES.SAVED_FOR_SUBMISSION);
    expect(draft.caseId).toBe('AYT-9');

    const submitted = await createCase(doctorActor() as never, {
      patientName: 'Jane',
      treatmentSummary: 'aligners',
      chiefComplaint: 'crowding',
      prosthoDetails: { restorationType: 'crown' },
      implantDetails: { implantSystem: 'straumann' },
    } as never);
    expect(submitted.status).toBe(CASE_STATUSES.NEW_CASE);
  });

  it('lists only the doctor own-scope filter', async () => {
    const owned = makeCase();
    Case.find.mockReturnValue(mockQuery([owned]));
    Case.countDocuments.mockResolvedValue(1);
    const result = await listCases(doctorActor() as never, { status: CASE_STATUSES.NEW_CASE });
    expect(result.total).toBe(1);
    expect(result.items[0]?.caseId).toBe('AYT-1001');
  });

  it('lets assigned designers view a case', async () => {
    Case.findOne.mockResolvedValue(makeCase({ assignedDesignerId: DESIGNER_ID }));
    const detail = await getCaseById(designerActor() as never, 'AYT-1001');
    expect(detail.caseId).toBe('AYT-1001');
  });

  it('lets staff cancel outside the 15-minute window with CASE_DELETE', async () => {
    const caseDoc = makeCase({
      submittedAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    Case.findOne.mockResolvedValue(caseDoc);
    CancellationAudit.create.mockResolvedValue({});
    await cancelCase(
      {
        ...doctorActor(),
        id: COORD_ID,
        role: ROLES.ADMIN,
        permissions: [PERMISSIONS.CASE_DELETE, PERMISSIONS.CASE_VIEW_ALL],
      } as never,
      'AYT-1001',
      'Clinical duplication',
    );
    expect(caseDoc.status).toBe(CASE_STATUSES.CANCELLED);
  });

  it('moves New Case to In Process when validation starts', async () => {
    const caseDoc = makeCase();
    Case.findOne.mockResolvedValue(caseDoc);
    const detail = await startCaseValidation(coordinatorActor() as never, 'AYT-1001');
    expect(caseDoc.status).toBe(CASE_STATUSES.IN_PROCESS);
    expect(detail.status).toBe(CASE_STATUSES.IN_PROCESS);
  });

  it('marks a New Case validated', async () => {
    const caseDoc = makeCase();
    Case.findOne.mockResolvedValue(caseDoc);
    await markCaseValidated(coordinatorActor() as never, 'AYT-1001', { force: true });
    expect(caseDoc.validatedAt).toBeInstanceOf(Date);
    expect(caseDoc.status).toBe(CASE_STATUSES.IN_PROCESS);
  });

  it('assigns a designer after validation', async () => {
    const caseDoc = makeCase({
      validatedAt: new Date(),
      status: CASE_STATUSES.NEW_CASE,
    });
    Case.findOne.mockResolvedValue(caseDoc);
    User.findById.mockResolvedValue({
      _id: DESIGNER_ID,
      id: DESIGNER_ID,
      firstName: 'Des',
      lastName: 'Ign',
      role: ROLES.DESIGNER,
      roles: [ROLES.DESIGNER],
      isActive: true,
    });
    await assignCase(coordinatorActor() as never, 'AYT-1001', {
      mode: 'designer',
      designerId: DESIGNER_ID,
    });
    expect(caseDoc.status).toBe(CASE_STATUSES.IN_PROCESS);
    expect(String(caseDoc.assignedDesignerId)).toBe(DESIGNER_ID);
  });

  it('rejects blocked file extensions and stores allowed STL files', async () => {
    Case.findOne.mockResolvedValue(makeCase());
    await expect(
      uploadCaseFiles(doctorActor() as never, 'AYT-1001', [
        { originalname: 'malware.exe', mimetype: 'application/octet-stream', size: 10 },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    const caseDoc = makeCase();
    Case.findOne.mockResolvedValue(caseDoc);
    await uploadCaseFiles(doctorActor() as never, 'AYT-1001', [
      {
        originalname: 'upper.stl',
        mimetype: 'model/stl',
        size: 12,
        buffer: Buffer.from('solid'),
      },
    ]);
    expect(persistUploadedFile).toHaveBeenCalled();
    expect(caseDoc.files.length).toBeGreaterThan(0);
  });

  it('submits to QC then rejects and approves', async () => {
    const readyForQc = makeCase({
      status: CASE_STATUSES.IN_PROCESS,
      assignedDesignerId: DESIGNER_ID,
      submittedToQcAt: null,
      qcRejectionCount: 0,
    });
    Case.findOne.mockResolvedValue(readyForQc);
    await submitCaseToQc(designerActor() as never, 'AYT-1001', { notes: 'ready' });
    expect(readyForQc.submittedToQcAt).toBeInstanceOf(Date);

    const rejected = makeCase({
      status: CASE_STATUSES.IN_PROCESS,
      assignedDesignerId: DESIGNER_ID,
      submittedToQcAt: new Date(),
      qcRejectionCount: 1,
    });
    Case.findOne.mockResolvedValue(rejected);
    await rejectQcCase(qcActor() as never, 'AYT-1001', {
      errorCode: QC_ERROR_CODES.FIT_ISSUE,
      comments: 'Margin open',
      requiredChanges: 'Rescan the prep',
    });
    expect(rejected.qcRejectionCount).toBe(2);
    expect(rejected.escalatedForOversight).toBe(true);

    const approved = makeCase({
      status: CASE_STATUSES.IN_PROCESS,
      assignedDesignerId: DESIGNER_ID,
      submittedToQcAt: new Date(),
    });
    Case.findOne.mockResolvedValue(approved);
    const detail = await approveQcCase(qcActor() as never, 'AYT-1001', {
      comments: 'Looks good',
      deliveryViewLink: 'https://viewer.example/case',
    });
    expect(approved.status).toBe(CASE_STATUSES.WAITING_FOR_APPROVAL);
    expect(detail.status).toBe(CASE_STATUSES.WAITING_FOR_APPROVAL);
  });

  it('builds coordinator and QC dashboards', async () => {
    Case.find.mockReturnValue(mockQuery([makeCase({ status: CASE_STATUSES.NEW_CASE })]));
    const coord = await getCoordinatorDashboard(coordinatorActor() as never);
    expect(coord.buckets.length).toBeGreaterThan(0);

    Case.find.mockReturnValue(
      mockQuery([
        makeCase({
          status: CASE_STATUSES.IN_PROCESS,
          submittedToQcAt: new Date(),
        }),
      ]),
    );
    const qc = await getQcDashboard(qcActor() as never);
    expect(qc.pendingCount).toBe(1);
  });
});
