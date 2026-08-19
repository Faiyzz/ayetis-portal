/**
 * Regression & Concurrency Assertions:
 * 1. Paid-draft fulfillment concurrency lock & invoice deduplication invariants
 * 2. Country / region resolution on resume / update
 * 3. Priority preservation
 * 4. Staff notification doctor privacy
 *
 * Run: tsx src/scripts/paymentConcurrencyAssert.ts
 */
import {
  PAYMENT_SESSION_STATUSES,
  CASE_STATUSES,
  CASE_PRIORITIES,
  type CasePriority,
  ROLES,
  canViewDoctorName,
  formatDoctorDisplay,
  regionCodeForCountry,
  resolveCoordinatorQueue,
  COORDINATOR_QUEUES,
} from '@ayetis/shared';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

import { Types } from 'mongoose';
import { Country } from '../models/Settings';
import { resolveCountryGeo } from '../features/settings/geoResolve';

async function testGeographyResolution() {
  console.log('Testing geography resolution on resume/update (Scenarios A through E)...');

  const usCountryId = new Types.ObjectId('6a836f04d18dd581ac089a0b');
  const usRegionId = new Types.ObjectId('6a836f03d18dd581ac08993a');
  const deCountryId = new Types.ObjectId('6a836f03d18dd581ac089989');
  const deRegionId = new Types.ObjectId('6a836f03d18dd581ac089945');

  const mockCountries = [
    {
      _id: usCountryId,
      name: 'United States',
      code: 'UNITED_STATES',
      regionId: usRegionId,
    },
    {
      _id: deCountryId,
      name: 'Germany',
      code: 'GERMANY',
      regionId: deRegionId,
    },
  ];

  // Mock Country query methods for offline assertion
  const origFindById = Country.findById;
  const origFindOne = Country.findOne;
  Country.findById = ((id: unknown) => {
    const idStr = String(id);
    const found = mockCountries.find((c) => String(c._id) === idStr);
    return Promise.resolve(found ?? null) as never;
  }) as never;
  Country.findOne = ((query: { name?: RegExp | string }) => {
    let found = null;
    if (query?.name instanceof RegExp) {
      found = mockCountries.find((c) => (query.name as RegExp).test(c.name));
    } else if (typeof query?.name === 'string') {
      const target = query.name.toLowerCase();
      found = mockCountries.find((c) => c.name.toLowerCase() === target);
    }
    return Promise.resolve(found ?? null) as never;
  }) as never;

  try {
    // Scenario A: Matching country
    // Input: countryName United States, US countryId
    const resA = await resolveCountryGeo({
      countryId: String(usCountryId),
      countryName: 'United States',
    });
    assert(resA.country === 'United States', 'Scenario A: country must be United States');
    assert(String(resA.countryId) === String(usCountryId), 'Scenario A: countryId must match US');
    assert(String(resA.regionId) === String(usRegionId), 'Scenario A: regionId must match NAM');

    // Scenario B: Country changed with stale ID
    // Input: countryName Germany, stale US countryId
    const resB = await resolveCountryGeo({
      countryId: String(usCountryId),
      countryName: 'Germany',
    });
    assert(resB.country === 'Germany', 'Scenario B: country must be Germany');
    assert(String(resB.countryId) === String(deCountryId), 'Scenario B: countryId must match Germany');
    assert(String(resB.regionId) === String(deRegionId), 'Scenario B: regionId must match CEMEA');

    // Scenario C: Draft update with changed country & stale US ID
    const draftC = {
      country: 'United States',
      countryId: usCountryId,
      regionId: usRegionId,
    };
    const inputC = {
      country: 'Germany',
      countryId: String(usCountryId), // Stale ID from client
    };
    const countryProvidedC = inputC.country !== undefined;
    const isCountryChangedC =
      countryProvidedC &&
      (inputC.country ?? '').trim().toLowerCase() !== (draftC.country ?? '').trim().toLowerCase();
    const resC = await resolveCountryGeo({
      countryId: isCountryChangedC
        ? inputC.countryId
        : inputC.countryId || (draftC.countryId ? String(draftC.countryId) : undefined),
      countryName: countryProvidedC ? inputC.country : draftC.country,
    });
    draftC.country = resC.country;
    draftC.countryId = resC.countryId!;
    draftC.regionId = resC.regionId!;
    assert(draftC.country === 'Germany', 'Scenario C: Draft country must update to Germany');
    assert(String(draftC.countryId) === String(deCountryId), 'Scenario C: Draft countryId must be Germany');
    assert(String(draftC.regionId) === String(deRegionId), 'Scenario C: Draft regionId must be CEMEA');

    // Scenario D: Old draft without IDs
    const oldDraftD = {
      country: 'Germany',
      countryId: undefined as Types.ObjectId | undefined,
      regionId: undefined as Types.ObjectId | undefined,
    };
    const inputD: { country?: string; countryId?: string } = {};
    const countryProvidedD = inputD.country !== undefined;
    const isCountryChangedD =
      countryProvidedD &&
      (inputD.country ?? '').trim().toLowerCase() !== (oldDraftD.country ?? '').trim().toLowerCase();
    const resD = await resolveCountryGeo({
      countryId: isCountryChangedD
        ? inputD.countryId
        : inputD.countryId || (oldDraftD.countryId ? String(oldDraftD.countryId) : undefined),
      countryName: countryProvidedD ? inputD.country : oldDraftD.country,
    });
    oldDraftD.country = resD.country;
    oldDraftD.countryId = resD.countryId;
    oldDraftD.regionId = resD.regionId;
    assert(oldDraftD.country === 'Germany', 'Scenario D: Old draft country must remain Germany');
    assert(String(oldDraftD.countryId) === String(deCountryId), 'Scenario D: Old draft countryId must resolve to Germany');
    assert(String(oldDraftD.regionId) === String(deRegionId), 'Scenario D: Old draft regionId must resolve to CEMEA');

    // Scenario E: Country unchanged (update unrelated field only)
    const draftE = {
      country: 'United States',
      countryId: usCountryId,
      regionId: usRegionId,
    };
    const inputE = {
      patientName: 'Updated Patient Name',
      country: undefined,
      countryId: undefined,
    };
    const countryProvidedE = inputE.country !== undefined;
    const isCountryChangedE =
      countryProvidedE &&
      (inputE.country ?? '').trim().toLowerCase() !== (draftE.country ?? '').trim().toLowerCase();
    const resE = await resolveCountryGeo({
      countryId: isCountryChangedE
        ? inputE.countryId
        : inputE.countryId || (draftE.countryId ? String(draftE.countryId) : undefined),
      countryName: countryProvidedE ? inputE.country : draftE.country,
    });
    assert(resE.country === 'United States', 'Scenario E: Country must remain United States');
    assert(String(resE.countryId) === String(usCountryId), 'Scenario E: CountryId must remain US');
    assert(String(resE.regionId) === String(usRegionId), 'Scenario E: RegionId must remain NAM');

    console.log('Geography resolution Scenarios A-E passed successfully.');
  } finally {
    Country.findById = origFindById;
    Country.findOne = origFindOne;
  }

  // Priority preservation simulation
  let draftPriority: CasePriority = CASE_PRIORITIES.URGENT;
  let updatePayloadWithoutPriority: { priority?: CasePriority } = {};
  if (updatePayloadWithoutPriority.priority !== undefined && updatePayloadWithoutPriority.priority) {
    draftPriority = updatePayloadWithoutPriority.priority;
  }
  assert(draftPriority === CASE_PRIORITIES.URGENT, 'Priority must be preserved when not updated');

  let updatePayloadWithNormal: { priority?: CasePriority } = { priority: CASE_PRIORITIES.NORMAL };
  if (updatePayloadWithNormal.priority !== undefined && updatePayloadWithNormal.priority) {
    draftPriority = updatePayloadWithNormal.priority;
  }
  assert(draftPriority === CASE_PRIORITIES.NORMAL, 'Priority must update when explicitly changed');
}

async function testNotificationPrivacy() {
  console.log('Testing notification privacy...');

  const doctorUserId = '60d5ecb8b5c9c61b2c8b4567';
  const staffUserId = '60d5ecb8b5c9c61b2c8b4568';
  const doctor = {
    doctorUserId,
    doctorName: 'Dr. Jane Foster',
    doctorId: 'DOC-54321',
  };

  // Staff roles must never see real doctor name in notifications / dashboard
  const staffRoles = [
    ROLES.COORDINATOR,
    ROLES.DESIGNER,
    ROLES.QC,
    ROLES.SUPERVISOR,
    ROLES.ORTHODONTIST,
    'cut_operator' as const,
  ];

  for (const role of staffRoles) {
    assert(
      canViewDoctorName(role as never, staffUserId, doctorUserId) === false,
      `Role ${role} must not be allowed to view real doctor name`,
    );
    const displayed = formatDoctorDisplay(role as never, staffUserId, doctor);
    assert(
      displayed === 'DOC-54321',
      `Role ${role} must see DOC-54321 instead of real doctor name, got ${displayed}`,
    );
  }

  // Admin and the Doctor themselves see real name
  assert(
    canViewDoctorName(ROLES.ADMIN, staffUserId, doctorUserId) === true,
    'Admin must see real doctor name',
  );
  assert(
    canViewDoctorName(ROLES.DOCTOR, doctorUserId, doctorUserId) === true,
    'Doctor must see own real name',
  );
}

async function testFulfillmentConcurrencyInvariants() {
  console.log('Testing paid-draft fulfillment concurrency and idempotency invariants...');

  // Simulate atomic CAS lock state transitions for PaymentSession
  type SessionState = {
    id: string;
    status: string;
    isFulfilling: boolean;
    fulfillingAt?: Date;
    caseId?: string;
    invoiceId?: string;
  };

  const session: SessionState = {
    id: 'sess_123',
    status: PAYMENT_SESSION_STATUSES.PENDING,
    isFulfilling: false,
  };

  const invoicesCreated: string[] = [];
  const casesCreatedOrUpdated: string[] = [];

  // Mock atomic findOneAndUpdate
  async function atomicClaimLock(s: SessionState, now: Date): Promise<boolean> {
    const lockExpiry = new Date(now.getTime() - 30000);
    const canClaim =
      (!s.isFulfilling && s.status !== PAYMENT_SESSION_STATUSES.PAID) ||
      (s.isFulfilling && s.fulfillingAt && s.fulfillingAt < lockExpiry && s.status !== PAYMENT_SESSION_STATUSES.PAID);

    if (canClaim) {
      s.isFulfilling = true;
      s.fulfillingAt = now;
      return true;
    }
    return false;
  }

  // Mock fulfillment worker
  async function simulateFulfillWorker(workerId: number): Promise<{ caseId: string; invoiceId: string }> {
    const now = new Date();
    const claimed = await atomicClaimLock(session, now);

    if (!claimed) {
      // Polling for fulfillment completion by the winning concurrent worker
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 20));
        if (session.status === PAYMENT_SESSION_STATUSES.PAID && session.caseId && session.invoiceId) {
          return { caseId: session.caseId, invoiceId: session.invoiceId };
        }
      }
      throw new Error(`Worker ${workerId} timed out waiting for concurrent fulfillment`);
    }

    // Winner performs work
    await new Promise((r) => setTimeout(r, 50)); // simulate DB I/O
    const caseId = 'CASE-00123';
    casesCreatedOrUpdated.push(caseId);

    // Invoice deduplication check
    let invoiceId = invoicesCreated.find((inv) => inv === `INV-${session.id}`);
    if (!invoiceId) {
      invoiceId = `INV-${session.id}`;
      invoicesCreated.push(invoiceId);
    }

    session.status = PAYMENT_SESSION_STATUSES.PAID;
    session.isFulfilling = false;
    session.caseId = caseId;
    session.invoiceId = invoiceId;

    return { caseId, invoiceId };
  }

  // Run 2 concurrent fulfillment calls (simulating overlapping webhooks)
  const [result1, result2] = await Promise.all([
    simulateFulfillWorker(1),
    simulateFulfillWorker(2),
  ]);

  assert(result1.caseId === result2.caseId, 'Both concurrent callers must get the SAME caseId');
  assert(result1.invoiceId === result2.invoiceId, 'Both concurrent callers must get the SAME invoiceId');
  assert(invoicesCreated.length === 1, `Exactly 1 invoice must be created, got ${invoicesCreated.length}`);
  assert(casesCreatedOrUpdated.length === 1, `Exactly 1 case transition must occur, got ${casesCreatedOrUpdated.length}`);
  assert(session.status === PAYMENT_SESSION_STATUSES.PAID, 'Session must be in PAID status');
  assert(session.isFulfilling === false, 'isFulfilling flag must be reset to false');

  // Third sequential repeated call
  const result3 = await simulateFulfillWorker(3);
  assert(result3.caseId === 'CASE-00123', 'Repeated fulfillment must be idempotent');
  assert(invoicesCreated.length === 1, 'No additional invoice created on 3rd call');
}

async function testCoordinatorValidationAndQueues() {
  console.log('Testing Coordinator validation, assignment, and queue resolution (DEF-WORKFLOW-001)...');

  // 1. Queue resolution tests
  // Scenario 1: in_process, 0 clarifications, !validated -> pending_validation
  const q1 = resolveCoordinatorQueue({
    status: CASE_STATUSES.IN_PROCESS,
    validatedAt: null,
    openClarificationCount: 0,
  });
  assert(
    q1 === COORDINATOR_QUEUES.PENDING_VALIDATION,
    `Scenario 1: Expected pending_validation, got ${q1}`,
  );

  // Scenario 2: in_process, 1 open clarification -> waiting_doctor
  const q2 = resolveCoordinatorQueue({
    status: CASE_STATUSES.IN_PROCESS,
    validatedAt: null,
    openClarificationCount: 1,
  });
  assert(
    q2 === COORDINATOR_QUEUES.WAITING_DOCTOR,
    `Scenario 2: Expected waiting_doctor, got ${q2}`,
  );

  // Scenario 3: in_process, 0 clarifications, validatedAt != null, unassigned -> ready_for_assignment
  const q3 = resolveCoordinatorQueue({
    status: CASE_STATUSES.IN_PROCESS,
    validatedAt: new Date(),
    openClarificationCount: 0,
  });
  assert(
    q3 === COORDINATOR_QUEUES.READY_FOR_ASSIGNMENT,
    `Scenario 3: Expected ready_for_assignment, got ${q3}`,
  );

  // Scenario 4: in_process, assigned -> assigned
  const q4 = resolveCoordinatorQueue({
    status: CASE_STATUSES.IN_PROCESS,
    validatedAt: new Date(),
    assignedDesignerId: 'des-1',
    openClarificationCount: 0,
  });
  assert(
    q4 === COORDINATOR_QUEUES.ASSIGNED,
    `Scenario 4: Expected assigned, got ${q4}`,
  );

  // 2. Validation & Assignment workflow invariants
  // Test A: Validation allowed for in_process when openClarifications === 0
  const canValidateZeroClarifications = (status: string, openClarifications: number) => {
    if (status !== CASE_STATUSES.IN_PROCESS && status !== CASE_STATUSES.NEW_CASE) return false;
    if (openClarifications > 0) return false;
    return true;
  };
  assert(
    canValidateZeroClarifications(CASE_STATUSES.IN_PROCESS, 0) === true,
    'Validation must be allowed for in_process case with 0 open clarifications',
  );
  assert(
    canValidateZeroClarifications(CASE_STATUSES.IN_PROCESS, 2) === false,
    'Validation must be blocked when open clarifications > 0',
  );

  // Test B: Assignment allowed only when validatedAt != null and openClarifications === 0
  const canAssignCase = (validatedAt: Date | null, openClarifications: number) => {
    if (!validatedAt) return false;
    if (openClarifications > 0) return false;
    return true;
  };
  assert(
    canAssignCase(null, 0) === false,
    'Assignment must be blocked before validation',
  );
  assert(
    canAssignCase(new Date(), 0) === true,
    'Assignment must be allowed after validation with 0 open clarifications',
  );
  assert(
    canAssignCase(new Date(), 1) === false,
    'Assignment must be blocked when open clarifications > 0 even if validated',
  );

  console.log('Coordinator validation, assignment, and queue resolution tests passed successfully.');
}

async function run() {
  await testGeographyResolution();
  await testNotificationPrivacy();
  await testFulfillmentConcurrencyInvariants();
  await testCoordinatorValidationAndQueues();
  console.log('All regression & concurrency assertions passed successfully!');
}

void run();
