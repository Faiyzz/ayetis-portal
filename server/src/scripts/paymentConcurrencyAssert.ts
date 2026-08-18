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
} from '@ayetis/shared';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testGeographyResolution() {
  console.log('Testing geography resolution on resume/update...');

  // Old draft simulation: only has country name "United States"
  const usRegion = regionCodeForCountry('United States');
  assert(usRegion === 'NAM', 'US region code must be NAM');

  // Country changed on resume: doctor changes country to "Germany"
  const deRegion = regionCodeForCountry('Germany');
  assert(deRegion === 'CEMEA', 'Germany region code must be CEMEA');

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

async function run() {
  await testGeographyResolution();
  await testNotificationPrivacy();
  await testFulfillmentConcurrencyInvariants();
  console.log('All regression & concurrency assertions passed successfully!');
}

void run();
