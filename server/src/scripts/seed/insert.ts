import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ALL_ACCOUNT_TYPES,
  ALL_ASSIGNMENT_QUEUES,
  ALL_AUDIT_ACTIONS,
  ALL_BILLING_ARRANGEMENTS,
  ALL_CASE_CATEGORIES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_CLARIFICATION_PRIORITIES,
  ALL_CLARIFICATION_SENDER_ROLES,
  ALL_CLARIFICATION_STATUSES,
  ALL_COMPLAINT_STATUSES,
  ALL_COMPLAINT_TYPES,
  ALL_DELETE_RECORD_TYPES,
  ALL_DELETE_REQUEST_STATUSES,
  ALL_DEPARTMENT_TYPES,
  ALL_EXPERIENCE_LEVELS,
  ALL_NOTIFICATION_TYPES,
  ALL_PAYMENT_PROVIDERS,
  ALL_PAYMENT_STATUSES,
  ALL_REFUND_STATUSES,
  ALL_REGISTRATION_STATUSES,
  ASSIGNMENT_MODES,
  CASE_STATUSES,
  CASE_TYPES_BY_CATEGORY,
  CLARIFICATION_MESSAGE_KINDS,
  CONSULTANT_INDICATORS,
  COUNTRY_REQUEST_STATUSES,
  CUT_ASSIGNMENT_MODES,
  CUT_PHASES,
  DEFAULT_CANCEL_REASONS,
  DOCTOR_DECISIONS,
  FILE_CATEGORIES,
  FILE_RESTORE_STATUSES,
  FILE_STORAGE_TIERS,
  GENDER_OPTIONS,
  MASTER_LIST_TYPES,
  NOTIFICATION_TYPE_LABELS,
  ORGANIZATION_STATUSES,
  PAYMENT_SESSION_STATUSES,
  PAYMENT_STATUSES,
  PREPAID_LEDGER_KINDS,
  PRICE_SUBJECT_TYPES,
  QC_REVIEW_OUTCOMES,
  type CaseCategory,
  type CaseStatus,
} from '@ayetis/shared';
import { faker } from '@faker-js/faker';
import { Types } from 'mongoose';
import { ActivityLog } from '../../models/ActivityLog';
import { CancellationAudit } from '../../models/CancellationAudit';
import { Case } from '../../models/Case';
import { Clarification } from '../../models/Clarification';
import {
  CustomerPriceOverride,
  Invoice,
  PaymentReceipt,
  PaymentSession,
  PrepaidLedgerEntry,
} from '../../models/Commercial';
import { Complaint } from '../../models/Complaint';
import { CorporateCounter } from '../../models/CorporateCounter';
import { DeleteRequest } from '../../models/DeleteRequest';
import { Department } from '../../models/Department';
import { DiscountCode } from '../../models/DiscountCode';
import { DocumentCounter } from '../../models/DocumentCounter';
import { DoctorCounter } from '../../models/DoctorCounter';
import { Facility } from '../../models/Facility';
import { Notification } from '../../models/Notification';
import { Organization } from '../../models/Organization';
import { AssignmentRule, Team } from '../../models/Rbac';
import { RegistrationRequest } from '../../models/RegistrationRequest';
import { Country, CountryRequest, MasterListItem, Region } from '../../models/Settings';
import { TreatmentPlan } from '../../models/TreatmentPlan';
import { User } from '../../models/User';
import {
  AUDIT_TARGET_TYPES,
  CORP_SEQ_START,
  COUNT,
  DEMO_EMAIL_DOMAIN,
  DOCUMENT_SEQ_START,
  DOCTOR_SEQ_START,
  STAFF_ROLES,
} from './constants';
import {
  academicTitle,
  caseDisplayId,
  complaintCode,
  corporateCustomerId,
  demoEmail,
  departmentCode,
  discountCode,
  doctorDisplayId,
  employeeDisplayId,
  fakeAddress,
  fakeCountry,
  fakeMobile,
  fullName,
  invoiceDisplayId,
  personName,
  pick,
  profession,
  receiptDisplayId,
  specialization,
  subAccountDisplayId,
} from './factories';

type UserSeed = {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  doctorId?: string;
};

type DemoUser = UserSeed & {
  password: string;
  clinicName?: string;
  companyName?: string;
  corporateCustomerId?: string;
  billingArrangement?: string;
  prepaidCaseBalance: number;
};

function ids(count = COUNT): Types.ObjectId[] {
  return Array.from({ length: count }, () => new Types.ObjectId());
}

function range(count = COUNT): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

function byRole(users: UserSeed[], ...roles: string[]): UserSeed[] {
  return users.filter((user) => roles.includes(user.role));
}

function baseUser(input: {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: string;
  accountType: string;
  index: number;
  doctorId?: string;
  organizationId?: Types.ObjectId;
  facilityId?: Types.ObjectId;
  corporateCustomerId?: string;
  employeeId?: string;
  subAccountId?: string;
  clinicName?: string;
  companyName?: string;
  prepaidCaseBalance?: number;
  billingArrangement?: string;
  departmentId?: Types.ObjectId;
  experienceLevel?: string;
}): DemoUser {
  const name = personName();
  const address = fakeAddress(input.index);
  const doc: DemoUser & Record<string, unknown> = {
    _id: input._id,
    email: input.email,
    password: input.password,
    firstName: name.firstName,
    lastName: name.lastName,
    role: input.role,
    roles: [input.role],
    primaryRole: input.role,
    accountType: input.accountType,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    isActive: true,
    emailVerifiedAt: faker.date.recent({ days: 20 }),
    mustChangePassword: false,
    isAvailable: true,
    themePreference: 'light',
    failedLoginAttempts: 0,
    prepaidCaseBalance: input.prepaidCaseBalance ?? 0,
    preferredCurrency: 'USD',
    mobile: fakeMobile(),
    assignedCountry: address.country,
    companyAddress: address,
    clinicName: input.clinicName,
    companyName: input.companyName,
    doctorId: input.doctorId,
    organizationId: input.organizationId,
    facilityId: input.facilityId,
    corporateCustomerId: input.corporateCustomerId,
    employeeId: input.employeeId,
    subAccountId: input.subAccountId,
    billingArrangement: input.billingArrangement,
    departmentId: input.departmentId,
    departmentName: input.departmentId ? `SEED Dept ${input.index + 1}` : undefined,
    experienceLevel: input.experienceLevel ?? pick(ALL_EXPERIENCE_LEVELS, input.index),
    softwareExpertise: [],
    permissionGrants: [],
    permissionDenies: [],
    teamIds: [] as Types.ObjectId[],
    regionIds: [] as Types.ObjectId[],
    scopedCountryIds: [] as Types.ObjectId[],
    excludedCountryIds: [] as Types.ObjectId[],
    passwordHistory: [] as string[],
  };

  const uniqueOptional = ['doctorId', 'employeeId', 'subAccountId', 'corporateCustomerId'] as const;
  for (const key of uniqueOptional) {
    if (doc[key] == null) {
      delete doc[key];
    }
  }
  return doc;
}

async function resetDemoData(): Promise<void> {
  const seedUsers = await User.find({ email: { $regex: `@${DEMO_EMAIL_DOMAIN}$` } }).select('_id');
  const seedUserIds = seedUsers.map((user) => user._id);
  const seedOrgs = await Organization.find({ corporateCustomerId: { $regex: /^C90\d{4}$/ } }).select(
    '_id',
  );
  const seedOrgIds = seedOrgs.map((org) => org._id);

  await Promise.all([
    Notification.deleteMany({
      $or: [{ userId: { $in: seedUserIds } }, { caseId: { $regex: /^AYT-SEED-/ } }],
    }),
    ActivityLog.deleteMany({
      $or: [
        { actorId: { $in: seedUserIds } },
        { actorEmail: { $regex: `@${DEMO_EMAIL_DOMAIN}$` } },
      ],
    }),
    DeleteRequest.deleteMany({ requestedById: { $in: seedUserIds } }),
    CancellationAudit.deleteMany({ caseId: { $regex: /^AYT-SEED-/ } }),
    Clarification.deleteMany({ caseId: { $regex: /^AYT-SEED-/ } }),
    Complaint.deleteMany({ complaintCode: { $regex: /^CMP-SEED-/ } }),
    PaymentReceipt.deleteMany({ receiptNumber: { $regex: /^RCPT-00009/ } }),
    Invoice.deleteMany({ invoiceNumber: { $regex: /^INV-00009/ } }),
    PaymentSession.deleteMany({ userId: { $in: seedUserIds } }),
    PrepaidLedgerEntry.deleteMany({
      $or: [{ subjectId: { $in: seedUserIds } }, { subjectId: { $in: seedOrgIds } }],
    }),
    CustomerPriceOverride.deleteMany({
      $or: [{ subjectId: { $in: seedUserIds } }, { subjectId: { $in: seedOrgIds } }],
    }),
    DiscountCode.deleteMany({ code: { $regex: /^SEED\d{2}OFF$/ } }),
    Case.deleteMany({ caseId: { $regex: /^AYT-SEED-/ } }),
    AssignmentRule.deleteMany({ name: { $regex: /^SEED / } }),
    Team.deleteMany({ name: { $regex: /^SEED / } }),
    Department.deleteMany({ code: { $regex: /^SEED/ } }),
    CountryRequest.deleteMany({ proposedName: { $regex: /^Seedland / } }),
    MasterListItem.deleteMany({ code: { $regex: /^SEED/ } }),
    RegistrationRequest.deleteMany({ email: { $regex: `@${DEMO_EMAIL_DOMAIN}$` } }),
    Facility.deleteMany({ organizationId: { $in: seedOrgIds } }),
    Organization.deleteMany({ _id: { $in: seedOrgIds } }),
    TreatmentPlan.deleteMany({ name: { $regex: /^SEED / } }),
    User.deleteMany({ _id: { $in: seedUserIds } }),
  ]);
}

async function bumpCounters(): Promise<void> {
  await Promise.all([
    DoctorCounter.updateOne(
      { key: 'doctor' },
      { $max: { seq: DOCTOR_SEQ_START + 59 } },
      { upsert: true },
    ),
    CorporateCounter.updateOne(
      { key: 'corporate_customer' },
      { $max: { seq: CORP_SEQ_START + COUNT - 1 } },
      { upsert: true },
    ),
    DocumentCounter.updateOne(
      { key: 'invoice' },
      { $max: { seq: DOCUMENT_SEQ_START + COUNT - 1 } },
      { upsert: true },
    ),
    DocumentCounter.updateOne(
      { key: 'receipt' },
      { $max: { seq: DOCUMENT_SEQ_START + COUNT - 1 } },
      { upsert: true },
    ),
  ]);
}

export type SeedSummary = {
  doctors: string[];
  corporate: string[];
  staffSample: string[];
};

export async function seedDemo(passwordHash: string): Promise<SeedSummary> {
  await resetDemoData();

  const [regions, countries] = await Promise.all([
    Region.find({ isActive: true }).select('_id code').lean(),
    Country.find({ isActive: true, isOther: { $ne: true } }).select('_id name').lean(),
  ]);

  const individualIds = ids();
  const corpAdminIds = ids();
  const facilityAdminIds = ids();
  const employeeIds = ids();
  const subAccountIds = ids();
  const staffIds = ids();
  const orgIds = ids();
  const facilityIds = ids();
  const departmentIds = ids();
  const teamIds = ids();
  const planIds = ids();
  const caseMongoIds = ids();
  const invoiceIds = ids();
  const sessionIds = ids();
  const receiptIds = ids();

  const individualDoctors = range().map((i) =>
    baseUser({
      _id: individualIds[i],
      email: demoEmail('doctor', i),
      password: passwordHash,
      role: 'doctor',
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
      index: i,
      doctorId: doctorDisplayId(0, i),
      clinicName: `${faker.company.name()} Clinic`,
      prepaidCaseBalance: i < 10 ? 5 : 0,
      billingArrangement: pick(ALL_BILLING_ARRANGEMENTS, i),
    }),
  );

  const corpAdmins = range().map((i) =>
    baseUser({
      _id: corpAdminIds[i],
      email: demoEmail('corporate', i),
      password: passwordHash,
      role: 'corporate_admin',
      accountType: ACCOUNT_TYPES.CORPORATE,
      index: i + 20,
      organizationId: orgIds[i],
      corporateCustomerId: corporateCustomerId(i),
      companyName: `SEED ${faker.company.name()}`,
      prepaidCaseBalance: i < 10 ? 10 : 0,
      billingArrangement: pick(ALL_BILLING_ARRANGEMENTS, i + 3),
    }),
  );

  const facilityAdmins = range().map((i) =>
    baseUser({
      _id: facilityAdminIds[i],
      email: demoEmail('facility', i),
      password: passwordHash,
      role: 'facility_admin',
      accountType: ACCOUNT_TYPES.CORPORATE,
      index: i + 40,
      organizationId: orgIds[i],
      facilityId: facilityIds[i],
      corporateCustomerId: corporateCustomerId(i),
      companyName: corpAdmins[i].companyName,
    }),
  );

  const employees = range().map((i) =>
    baseUser({
      _id: employeeIds[i],
      email: demoEmail('employee', i),
      password: passwordHash,
      role: 'doctor',
      accountType: ACCOUNT_TYPES.CORPORATE,
      index: i + 60,
      doctorId: doctorDisplayId(20, i),
      organizationId: orgIds[i],
      facilityId: facilityIds[i],
      corporateCustomerId: corporateCustomerId(i),
      employeeId: employeeDisplayId(i),
      clinicName: `SEED Facility ${i + 1}`,
      companyName: corpAdmins[i].companyName,
    }),
  );

  const subAccounts = range().map((i) =>
    baseUser({
      _id: subAccountIds[i],
      email: demoEmail('subaccount', i),
      password: passwordHash,
      role: 'doctor',
      accountType: ACCOUNT_TYPES.CORPORATE,
      index: i + 80,
      doctorId: doctorDisplayId(40, i),
      organizationId: orgIds[i],
      facilityId: facilityIds[i],
      corporateCustomerId: corporateCustomerId(i),
      subAccountId: subAccountDisplayId(i),
      clinicName: `SEED Facility ${i + 1}`,
      companyName: corpAdmins[i].companyName,
    }),
  );

  const staff = range().map((i) =>
    baseUser({
      _id: staffIds[i],
      email: demoEmail(STAFF_ROLES[i], i),
      password: passwordHash,
      role: STAFF_ROLES[i],
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
      index: i + 100,
      departmentId: departmentIds[i],
      experienceLevel: pick(ALL_EXPERIENCE_LEVELS, i),
    }),
  );

  const allUsers = [
    ...individualDoctors,
    ...corpAdmins,
    ...facilityAdmins,
    ...employees,
    ...subAccounts,
    ...staff,
  ];
  await User.insertMany(allUsers);

  const userSeeds: UserSeed[] = allUsers.map((user) => ({
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    doctorId: user.doctorId,
  }));
  const staffSeeds = userSeeds.filter((_, i) => i >= 100);
  const designers = byRole(staffSeeds, 'designer', 'senior_designer');
  const consultants = byRole(staffSeeds, 'orthodontist');
  const cutOps = byRole(staffSeeds, 'cut_operator');
  const coordinators = byRole(staffSeeds, 'coordinator');
  const qcStaff = byRole(staffSeeds, 'qc', 'qc_self');
  const supervisors = byRole(staffSeeds, 'supervisor');

  await Organization.insertMany(
    range().map((i) => {
      const address = fakeAddress(i);
      return {
        _id: orgIds[i],
        corporateCustomerId: corporateCustomerId(i),
        companyName: corpAdmins[i].companyName,
        address,
        country: address.country,
        status: pick(Object.values(ORGANIZATION_STATUSES), i),
        ownerUserId: corpAdminIds[i],
        subAccountSeq: 1,
        employeeSeq: 1,
        billingArrangement: corpAdmins[i].billingArrangement,
        prepaidCaseBalance: corpAdmins[i].prepaidCaseBalance,
        preferredCurrency: 'USD',
        regionIds: regions[i % Math.max(regions.length, 1)]
          ? [regions[i % regions.length]._id]
          : [],
        scopedCountryIds: [],
        excludedCountryIds: [],
      };
    }),
  );

  await Facility.insertMany(
    range().map((i) => {
      const address = fakeAddress(i + 5);
      return {
        _id: facilityIds[i],
        organizationId: orgIds[i],
        corporateCustomerId: corporateCustomerId(i),
        name: `SEED ${address.city} Clinic`,
        country: address.country,
        state: address.state,
        city: address.city,
        address: address.street,
        timezone: faker.location.timeZone(),
        contactPhone: fakeMobile(),
        contactEmail: demoEmail('clinic', i),
        status: i % 7 === 0 ? 'inactive' : 'active',
      };
    }),
  );

  await Department.insertMany(
    range().map((i) => ({
      _id: departmentIds[i],
      name: `SEED ${pick(ALL_DEPARTMENT_TYPES, i)} ${i + 1}`,
      code: departmentCode(i),
      type: pick(ALL_DEPARTMENT_TYPES, i),
      description: faker.lorem.sentence(),
      supervisorId: supervisors[i % Math.max(supervisors.length, 1)]?._id,
      supervisorName: supervisors.length
        ? fullName(
            supervisors[i % supervisors.length].firstName,
            supervisors[i % supervisors.length].lastName,
          )
        : undefined,
      isActive: true,
      isDeleted: false,
    })),
  );

  await Team.insertMany(
    range().map((i) => ({
      _id: teamIds[i],
      name: `SEED Team ${i + 1}`,
      code: `SEEDT${String(i + 1).padStart(2, '0')}`,
      supervisorIds: supervisors.length ? [supervisors[i % supervisors.length]._id] : [],
      memberIds: [staffIds[i], staffIds[(i + 1) % COUNT]],
      regionIds: regions.length ? [regions[i % regions.length]._id] : [],
      isActive: true,
    })),
  );

  await AssignmentRule.insertMany(
    range().map((i) => ({
      name: `SEED ${pick(ALL_ASSIGNMENT_QUEUES, i)} rule ${i + 1}`,
      isActive: i % 6 !== 0,
      priority: i,
      targetQueue: pick(ALL_ASSIGNMENT_QUEUES, i),
      roleKeys: [pick(['designer', 'qc', 'cut_operator', 'orthodontist'], i)],
      teamIds: [teamIds[i]],
      regionIds: regions.length ? [regions[i % regions.length]._id] : [],
      countryIds: countries.length ? [countries[i % countries.length]._id] : [],
      excludedCountryIds: [],
      experienceLevels: [pick(ALL_EXPERIENCE_LEVELS, i)],
      softwareKeys: [`SEED_SW_${String(i + 1).padStart(2, '0')}`],
      requireAvailable: true,
      maxOpenCases: 8 + (i % 5),
      weight: 1 + (i % 4),
    })),
  );

  const plans = range().map((i) => {
    const category = pick(ALL_CASE_CATEGORIES, i) as CaseCategory;
    return {
      _id: planIds[i],
      name: `SEED ${faker.commerce.productName()} ${i + 1}`,
      caseCategory: category,
      description: faker.commerce.productDescription(),
      price: 80 + i * 15,
      currency: 'USD',
      estimatedDeliveryHours: 24 + (i % 4) * 12,
      isActive: i !== 19,
      isDefault: false,
      isFreeDemo: i === 0,
    };
  });
  await TreatmentPlan.insertMany(plans);

  const caseStatuses = ALL_CASE_STATUSES;
  const cases = range().map((i) => {
    const corporate = i >= 10;
    const doctor = corporate ? employees[i - 10] : individualDoctors[i];
    const status = pick(caseStatuses, i) as CaseStatus;
    const category = pick(ALL_CASE_CATEGORIES, i) as CaseCategory;
    const caseType = pick(CASE_TYPES_BY_CATEGORY[category], i);
    const plan = plans[i];
    const designer = designers[i % Math.max(designers.length, 1)];
    const consultant = consultants[i % Math.max(consultants.length, 1)];
    const cutOp = cutOps[i % Math.max(cutOps.length, 1)];
    const qc = qcStaff[i % Math.max(qcStaff.length, 1)];
    const submitted =
      status === CASE_STATUSES.SAVED_FOR_SUBMISSION
        ? undefined
        : faker.date.recent({ days: 12 });
    const doctorName = fullName(doctor.firstName, doctor.lastName);
    const inProcess = status === CASE_STATUSES.IN_PROCESS;
    const waiting = status === CASE_STATUSES.WAITING_FOR_APPROVAL;
    const approved = status === CASE_STATUSES.APPROVED;
    const cancelled = status === CASE_STATUSES.CANCELLED;

    return {
      _id: caseMongoIds[i],
      caseId: caseDisplayId(i),
      doctorId: doctor._id,
      doctorName,
      doctorDisplayId: doctor.doctorId,
      doctorEmail: doctor.email,
      organizationId: corporate ? orgIds[i - 10] : undefined,
      facilityId: corporate ? facilityIds[i - 10] : undefined,
      corporateCustomerId: corporate ? corporateCustomerId(i - 10) : undefined,
      caseCategory: category,
      caseType,
      chiefComplaint: faker.lorem.sentence(),
      practiceName: doctor.clinicName ?? doctor.companyName ?? 'SEED Practice',
      patientDateOfBirth: faker.date.birthdate({ min: 8, max: 70, mode: 'age' }),
      commercial: {
        treatmentApproach: category,
        treatmentSubCategory: caseType,
        treatmentPlanId: String(plan._id),
        treatmentPlanName: plan.name,
        currency: 'USD',
        unitPrice: plan.price,
        discountCode: i % 4 === 0 ? discountCode(i) : '',
        discountAmount: i % 4 === 0 ? 20 : null,
        finalPayableAmount: plan.price - (i % 4 === 0 ? 20 : 0),
      },
      submittedAt: submitted,
      slaHours: 48,
      slaDeadlineAt: submitted ? new Date(submitted.getTime() + 48 * 3600 * 1000) : undefined,
      patientName: faker.person.fullName(),
      patientAge: 8 + (i % 60),
      patientGender: pick(GENDER_OPTIONS, i).value,
      clinicName: doctor.clinicName ?? `SEED Clinic ${i + 1}`,
      country: fakeCountry(i),
      treatmentSummary: faker.lorem.paragraph(),
      instructions: faker.lorem.sentences(2),
      payment: {
        status: pick(ALL_PAYMENT_STATUSES, i),
        currency: 'USD',
        amountDue: plan.price,
        amountPaid: pick(ALL_PAYMENT_STATUSES, i) === PAYMENT_STATUSES.PAID ? plan.price : 0,
        invoiceNumber: invoiceDisplayId(i),
        notes: '',
      },
      status,
      priority: pick(ALL_CASE_PRIORITIES, i),
      assignmentMode: inProcess ? ASSIGNMENT_MODES.DESIGNER : ASSIGNMENT_MODES.NONE,
      assignedDesignerId: inProcess || waiting || approved ? designer?._id : undefined,
      assignedDesignerName: inProcess || waiting || approved
        ? designer
          ? fullName(designer.firstName, designer.lastName)
          : undefined
        : undefined,
      assignedConsultantId: waiting || approved ? consultant?._id : undefined,
      assignedConsultantName:
        (waiting || approved) && consultant
          ? fullName(consultant.firstName, consultant.lastName)
          : undefined,
      cutRequired: i % 5 === 0,
      cutPhase: i % 5 === 0 ? CUT_PHASES.CUT_COMPLETE : CUT_PHASES.NONE,
      cutAssignmentMode: i % 5 === 0 ? CUT_ASSIGNMENT_MODES.OPERATOR : CUT_ASSIGNMENT_MODES.NONE,
      assignedCutOperatorId: i % 5 === 0 ? cutOp?._id : undefined,
      assignedCutOperatorName:
        i % 5 === 0 && cutOp ? fullName(cutOp.firstName, cutOp.lastName) : undefined,
      productionNotes: inProcess ? faker.lorem.sentence() : '',
      qcRejectionCount: 0,
      escalatedForOversight: i % 9 === 0,
      delivery:
        waiting || approved
          ? {
              viewLink: `https://viewer.seed.ayetis.test/${caseDisplayId(i)}`,
              uploadedAt: faker.date.recent({ days: 3 }),
              uploadedById: designer?._id,
              uploadedByName: designer ? fullName(designer.firstName, designer.lastName) : 'SEED',
              storageTier: FILE_STORAGE_TIERS.HOT,
              restoreStatus: FILE_RESTORE_STATUSES.NONE,
            }
          : undefined,
      qcReviews:
        waiting || approved
          ? [
              {
                outcome: QC_REVIEW_OUTCOMES.APPROVED,
                comments: faker.lorem.sentence(),
                requiredChanges: '',
                reviewerId: qc?._id,
                reviewerName: qc ? fullName(qc.firstName, qc.lastName) : 'QC',
                createdAt: faker.date.recent({ days: 2 }),
              },
            ]
          : [],
      clinicalRemarks:
        waiting || approved
          ? [
              {
                body: faker.lorem.sentence(),
                indicator: pick(Object.values(CONSULTANT_INDICATORS), i),
                authorId: consultant?._id,
                authorName: consultant
                  ? fullName(consultant.firstName, consultant.lastName)
                  : 'Consultant',
                createdAt: faker.date.recent({ days: 2 }),
              },
            ]
          : [],
      consultantIndicator: waiting || approved ? CONSULTANT_INDICATORS.GREEN : undefined,
      doctorDecision: approved ? DOCTOR_DECISIONS.APPROVE : undefined,
      doctorDecisionAt: approved ? faker.date.recent({ days: 1 }) : undefined,
      cancelReason: cancelled ? pick(DEFAULT_CANCEL_REASONS, i) : undefined,
      notes: [
        {
          body: faker.lorem.sentence(),
          authorId: doctor._id,
          authorName: doctorName,
          createdAt: faker.date.recent({ days: 8 }),
        },
      ],
      files: [
        {
          filename: `scan-${i + 1}.stl`,
          originalName: `scan-${i + 1}.stl`,
          mimeType: 'model/stl',
          sizeBytes: 2048 * (i + 1),
          category: FILE_CATEGORIES.STL,
          storageKey: `seed/${caseDisplayId(i)}/scan.stl`,
          uploadedById: doctor._id,
          uploadedByName: doctorName,
          version: 1,
          scanStatus: 'skipped',
          storageTier: FILE_STORAGE_TIERS.HOT,
          restoreStatus: FILE_RESTORE_STATUSES.NONE,
          createdAt: faker.date.recent({ days: 8 }),
        },
      ],
      history: [
        {
          action: 'case.create',
          summary: `Seeded ${caseDisplayId(i)}`,
          actorId: doctor._id,
          actorName: doctorName,
          createdAt: faker.date.recent({ days: 10 }),
        },
      ],
      isDeleted: false,
      isDemo: i === 0,
      invoiceId: invoiceIds[i],
      paymentSessionId: sessionIds[i],
    };
  });
  await Case.insertMany(cases);

  await DiscountCode.insertMany(
    range().map((i) => ({
      code: discountCode(i),
      description: `SEED ${i % 2 === 0 ? 'percent' : 'amount'} off`,
      percentOff: i % 2 === 0 ? 10 + (i % 5) * 5 : undefined,
      amountOff: i % 2 === 1 ? 15 + i : undefined,
      currency: 'USD',
      customerUserId: i % 3 === 0 ? individualIds[i] : undefined,
      validFrom: faker.date.recent({ days: 30 }),
      validUntil: faker.date.soon({ days: 90 }),
      isActive: i !== 19,
      maxUses: 50,
      usageCount: i,
      applicableCaseCategories: [pick(ALL_CASE_CATEGORIES, i)],
      applicablePlanIds: [planIds[i]],
    })),
  );

  await CustomerPriceOverride.insertMany(
    range().map((i) => {
      const orgSubject = i % 2 === 1;
      return {
        subjectType: orgSubject ? PRICE_SUBJECT_TYPES.ORGANIZATION : PRICE_SUBJECT_TYPES.USER,
        subjectId: orgSubject ? orgIds[i] : individualIds[i],
        treatmentPlanId: planIds[i],
        price: 60 + i * 10,
        currency: 'USD',
        isActive: true,
      };
    }),
  );

  await PrepaidLedgerEntry.insertMany(
    range().map((i) => {
      const orgSubject = i >= 10;
      const delta = orgSubject ? 10 : 5;
      return {
        subjectType: orgSubject ? PRICE_SUBJECT_TYPES.ORGANIZATION : PRICE_SUBJECT_TYPES.USER,
        subjectId: orgSubject ? orgIds[i - 10] : individualIds[i],
        kind: PREPAID_LEDGER_KINDS.CREDIT,
        deltaCases: delta,
        balanceAfter: delta,
        reason: 'SEED prepaid credit',
        actorId: corpAdminIds[0],
        actorEmail: corpAdmins[0].email,
      };
    }),
  );

  const sessionStatuses = Object.values(PAYMENT_SESSION_STATUSES);
  await PaymentSession.insertMany(
    range().map((i) => {
      const status = pick(sessionStatuses, i);
      const paid = status === PAYMENT_SESSION_STATUSES.PAID;
      return {
        _id: sessionIds[i],
        userId: individualIds[i],
        status,
        provider: pick(ALL_PAYMENT_PROVIDERS, i),
        amount: plans[i].price,
        currency: 'USD',
        discountCode: i % 4 === 0 ? discountCode(i) : undefined,
        treatmentPlanId: planIds[i],
        isDemo: i === 0,
        createPayload: { source: 'seed', caseId: caseDisplayId(i) },
        checkoutUrl: `https://pay.seed.ayetis.test/${String(i + 1).padStart(2, '0')}`,
        caseId: caseMongoIds[i],
        invoiceId: invoiceIds[i],
        receiptId: paid ? receiptIds[i] : undefined,
        paidAt: paid ? faker.date.recent({ days: 4 }) : undefined,
        expiresAt: faker.date.soon({ days: 7 }),
      };
    }),
  );

  const invoiceStatuses = ['draft', 'issued', 'paid', 'void'] as const;
  await Invoice.insertMany(
    range().map((i) => {
      const status = pick(invoiceStatuses, i);
      const doctor = i >= 10 ? employees[i - 10] : individualDoctors[i];
      return {
        _id: invoiceIds[i],
        invoiceNumber: invoiceDisplayId(i),
        caseId: caseMongoIds[i],
        billedCaseIds: [caseDisplayId(i)],
        paymentSessionId: sessionIds[i],
        customerUserId: doctor._id,
        customerEmail: doctor.email,
        customerName: fullName(doctor.firstName, doctor.lastName),
        currency: 'USD',
        subtotal: plans[i].price,
        discountAmount: i % 4 === 0 ? 20 : 0,
        total: plans[i].price - (i % 4 === 0 ? 20 : 0),
        status,
        lineDescription: plans[i].name,
        htmlBody: `<p>SEED invoice ${invoiceDisplayId(i)}</p>`,
        issuedAt: faker.date.recent({ days: 6 }),
        paidAt: status === 'paid' ? faker.date.recent({ days: 2 }) : undefined,
      };
    }),
  );

  await PaymentReceipt.insertMany(
    range().map((i) => ({
      _id: receiptIds[i],
      receiptNumber: receiptDisplayId(i),
      invoiceId: invoiceIds[i],
      invoiceNumber: invoiceDisplayId(i),
      caseId: caseMongoIds[i],
      paymentSessionId: sessionIds[i],
      amount: plans[i].price - (i % 4 === 0 ? 20 : 0),
      currency: 'USD',
      provider: pick(ALL_PAYMENT_PROVIDERS, i),
      providerReference: `SEED-PAY-${i + 1}`,
      htmlBody: `<p>SEED receipt ${receiptDisplayId(i)}</p>`,
      paidAt: faker.date.recent({ days: 2 }),
    })),
  );

  await RegistrationRequest.insertMany(
    range().map((i) => {
      const name = personName();
      const status = pick(ALL_REGISTRATION_STATUSES, i);
      const accountType = pick(ALL_ACCOUNT_TYPES, i);
      const country = countries.length ? countries[i % countries.length] : undefined;
      return {
        email: demoEmail('reg', i),
        passwordHash,
        firstName: name.firstName,
        lastName: name.lastName,
        accountType,
        clinicName: accountType === ACCOUNT_TYPES.INDIVIDUAL ? `${faker.company.name()} Clinic` : undefined,
        companyName: accountType === ACCOUNT_TYPES.CORPORATE ? `SEED ${faker.company.name()}` : undefined,
        companyAddress: fakeAddress(i + 30),
        status,
        emailVerifiedAt:
          status === ALL_REGISTRATION_STATUSES[0] ? undefined : faker.date.recent({ days: 5 }),
        rejectionReason: status === 'rejected' ? faker.lorem.sentence() : undefined,
        countryId: country?._id,
        countryName: country?.name ?? fakeCountry(i),
        mobileCountryCode: '+1',
        mobileNumber: faker.string.numeric(10),
        gender: pick(GENDER_OPTIONS, i).value,
        language: 'English',
        profession: profession(i),
        professionSpecialization: specialization(i),
        academicTitle: academicTitle(i),
        privacyPolicyVersionAccepted: '1.0',
        preferredCurrency: 'USD',
      };
    }),
  );

  await Clarification.insertMany(
    range().map((i) => {
      const sender = pick(ALL_CLARIFICATION_SENDER_ROLES, i);
      const creator =
        sender === 'coordinator'
          ? coordinators[i % Math.max(coordinators.length, 1)]
          : sender === 'designer'
            ? designers[i % Math.max(designers.length, 1)]
            : sender === 'qc'
              ? qcStaff[i % Math.max(qcStaff.length, 1)]
              : sender === 'consultant'
                ? consultants[i % Math.max(consultants.length, 1)]
                : supervisors[i % Math.max(supervisors.length, 1)];
      const doctor = i >= 10 ? employees[i - 10] : individualDoctors[i];
      const status = pick(ALL_CLARIFICATION_STATUSES, i);
      const creatorName = creator
        ? fullName(creator.firstName, creator.lastName)
        : 'SEED Staff';
      return {
        caseId: caseDisplayId(i),
        caseMongoId: caseMongoIds[i],
        subject: faker.lorem.words({ min: 3, max: 6 }).slice(0, 200),
        requiredInfo: faker.lorem.paragraph(),
        status,
        senderRole: sender,
        clarificationType: 'missing_records',
        priority: pick(ALL_CLARIFICATION_PRIORITIES, i),
        isDraft: status === 'draft',
        createdById: creator?._id ?? staffIds[0],
        createdByName: creatorName,
        createdByRole: creator?.role ?? 'coordinator',
        messages: [
          {
            kind: CLARIFICATION_MESSAGE_KINDS.REQUEST,
            body: faker.lorem.sentence(),
            authorId: creator?._id ?? staffIds[0],
            authorName: creatorName,
            authorRole: creator?.role ?? 'coordinator',
            createdAt: faker.date.recent({ days: 4 }),
          },
          ...(status === 'awaiting_team' || status === 'resolved'
            ? [
                {
                  kind: CLARIFICATION_MESSAGE_KINDS.REPLY,
                  body: faker.lorem.sentence(),
                  authorId: doctor._id,
                  authorName: fullName(doctor.firstName, doctor.lastName),
                  authorRole: 'doctor',
                  createdAt: faker.date.recent({ days: 2 }),
                },
              ]
            : []),
        ],
        attachments: [],
      };
    }),
  );

  await Complaint.insertMany(
    range().map((i) => {
      const doctor = i >= 10 ? employees[i - 10] : individualDoctors[i];
      const creator = coordinators[i % Math.max(coordinators.length, 1)] ?? doctor;
      return {
        complaintCode: complaintCode(i),
        details: faker.lorem.paragraph(),
        caseId: caseDisplayId(i),
        doctorId: doctor._id,
        doctorName: fullName(doctor.firstName, doctor.lastName),
        responsibleEmployeeId: employees[i]._id,
        responsibleEmployeeName: fullName(employees[i].firstName, employees[i].lastName),
        responsibleQcId: qcStaff[i % Math.max(qcStaff.length, 1)]?._id,
        responsibleQcName: qcStaff.length
          ? fullName(
              qcStaff[i % qcStaff.length].firstName,
              qcStaff[i % qcStaff.length].lastName,
            )
          : undefined,
        responsibleConsultantId: consultants[i % Math.max(consultants.length, 1)]?._id,
        responsibleConsultantName: consultants.length
          ? fullName(
              consultants[i % consultants.length].firstName,
              consultants[i % consultants.length].lastName,
            )
          : undefined,
        responsibleSupervisorId: supervisors[i % Math.max(supervisors.length, 1)]?._id,
        responsibleSupervisorName: supervisors.length
          ? fullName(
              supervisors[i % supervisors.length].firstName,
              supervisors[i % supervisors.length].lastName,
            )
          : undefined,
        type: pick(ALL_COMPLAINT_TYPES, i),
        status: pick(ALL_COMPLAINT_STATUSES, i),
        rating: 1 + (i % 5),
        additionalComments: faker.lorem.sentence(),
        comments: [
          {
            text: faker.lorem.sentence(),
            authorId: creator._id,
            authorName: fullName(creator.firstName, creator.lastName),
            createdAt: faker.date.recent({ days: 3 }),
          },
        ],
        createdById: creator._id,
        createdByName: fullName(creator.firstName, creator.lastName),
      };
    }),
  );

  const cancelledIndexes = range().filter(
    (i) => pick(caseStatuses, i) === CASE_STATUSES.CANCELLED,
  );
  await CancellationAudit.insertMany(
    range().map((i) => {
      const sourceIndex = cancelledIndexes.length
        ? cancelledIndexes[i % cancelledIndexes.length]
        : i;
      const corporate = sourceIndex >= 10;
      const doctor = corporate ? employees[sourceIndex - 10] : individualDoctors[sourceIndex];
      const coordinator = coordinators[i % Math.max(coordinators.length, 1)];
      return {
        caseMongoId: caseMongoIds[sourceIndex],
        caseId: caseDisplayId(sourceIndex),
        patientName: faker.person.fullName(),
        doctorUserId: doctor._id,
        doctorName: fullName(doctor.firstName, doctor.lastName),
        doctorDisplayId: doctor.doctorId,
        coordinatorId: coordinator?._id,
        coordinatorName: coordinator
          ? fullName(coordinator.firstName, coordinator.lastName)
          : undefined,
        organizationId: corporate ? orgIds[sourceIndex - 10] : undefined,
        companyName: corporate ? corpAdmins[sourceIndex - 10].companyName : undefined,
        facilityId: corporate ? facilityIds[sourceIndex - 10] : undefined,
        accountType: corporate ? ACCOUNT_TYPES.CORPORATE : ACCOUNT_TYPES.INDIVIDUAL,
        caseCategory: pick(ALL_CASE_CATEGORIES, sourceIndex),
        treatmentPlanName: plans[sourceIndex].name,
        caseValue: plans[sourceIndex].price,
        currency: 'USD',
        invoiceNumber: invoiceDisplayId(sourceIndex),
        paymentStatus: pick(ALL_PAYMENT_STATUSES, i),
        refundAmount: i % 3 === 0 ? plans[sourceIndex].price : 0,
        refundStatus: pick(ALL_REFUND_STATUSES, i),
        cancellationReason: pick(DEFAULT_CANCEL_REASONS, i),
        cancellationRemarks: faker.lorem.sentence(),
        statusAtCancellation: CASE_STATUSES.CANCELLED,
        submittedAt: faker.date.recent({ days: 10 }),
        cancelledAt: faker.date.recent({ days: 4 }),
        remainingWindowSeconds: i % 2 === 0 ? 120 : 0,
        cancelledById: doctor._id,
        cancelledByName: fullName(doctor.firstName, doctor.lastName),
        cancelledByEmail: doctor.email,
        cancelledByRole: 'doctor',
      };
    }),
  );

  await DeleteRequest.insertMany(
    range().map((i) => {
      const recordType = pick(ALL_DELETE_RECORD_TYPES, i);
      const requester = coordinators[i % Math.max(coordinators.length, 1)] ?? individualDoctors[0];
      const status = pick(ALL_DELETE_REQUEST_STATUSES, i);
      const reviewed = status !== 'pending';
      const target =
        recordType === 'case'
          ? { id: String(caseMongoIds[i]), label: caseDisplayId(i), caseId: caseDisplayId(i) }
          : recordType === 'user'
            ? {
                id: String(individualIds[i]),
                label: fullName(individualDoctors[i].firstName, individualDoctors[i].lastName),
                caseId: undefined,
              }
            : {
                id: String(departmentIds[i]),
                label: `SEED Dept ${i + 1}`,
                caseId: undefined,
              };
      return {
        recordType,
        recordId: target.id,
        recordLabel: target.label,
        caseId: target.caseId,
        reason: faker.lorem.sentence(),
        status,
        requestedById: requester._id,
        requestedByName: fullName(requester.firstName, requester.lastName),
        requestedByEmail: requester.email,
        reviewedById: reviewed ? corpAdminIds[0] : undefined,
        reviewedByName: reviewed
          ? fullName(corpAdmins[0].firstName, corpAdmins[0].lastName)
          : undefined,
        reviewNote: reviewed ? faker.lorem.sentence() : undefined,
        reviewedAt: reviewed ? faker.date.recent({ days: 2 }) : undefined,
      };
    }),
  );

  await Notification.insertMany(
    range().map((i) => {
      const type = pick(ALL_NOTIFICATION_TYPES, i);
      const user = i % 2 === 0 ? individualDoctors[i] : staff[i];
      return {
        userId: user._id,
        type,
        title: NOTIFICATION_TYPE_LABELS[type],
        body: `SEED ${faker.lorem.sentence()}`,
        link: `/app/cases/${caseDisplayId(i)}`,
        caseId: caseDisplayId(i),
        isRead: i % 3 === 0,
      };
    }),
  );

  await ActivityLog.insertMany(
    range().map((i) => {
      const actor = i % 2 === 0 ? individualDoctors[i] : staff[i];
      return {
        action: pick(ALL_AUDIT_ACTIONS, i),
        actorId: actor._id,
        actorEmail: actor.email,
        actorName: fullName(actor.firstName, actor.lastName),
        actorRole: actor.role,
        targetType: pick(AUDIT_TARGET_TYPES, i),
        targetId: caseDisplayId(i),
        summary: `SEED ${faker.lorem.sentence()}`,
        metadata: { seed: true, index: i },
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
      };
    }),
  );

  await CountryRequest.insertMany(
    range().map((i) => {
      const status = pick(Object.values(COUNTRY_REQUEST_STATUSES), i);
      return {
        proposedName: `Seedland ${i + 1}`,
        status,
        requesterEmail: demoEmail('reg', i),
        regionId: regions.length ? regions[i % regions.length]._id : undefined,
        reviewNotes: status === COUNTRY_REQUEST_STATUSES.PENDING ? undefined : faker.lorem.sentence(),
        reviewedById: status === COUNTRY_REQUEST_STATUSES.PENDING ? undefined : corpAdminIds[0],
      };
    }),
  );

  await MasterListItem.insertMany([
    ...range().map((i) => ({
      type: MASTER_LIST_TYPES.SUPPORTED_SOFTWARE,
      code: `SEED_SW_${String(i + 1).padStart(2, '0')}`,
      label: `SEED Software ${i + 1}`,
      sortOrder: i,
      isActive: true,
      metadata: {},
    })),
    ...range().map((i) => ({
      type: MASTER_LIST_TYPES.MOBILE_COUNTRY_CODE,
      code: `SEED_DIAL_${String(i + 1).padStart(2, '0')}`,
      label: `SEED +8${String(i + 10)}`,
      sortOrder: i,
      isActive: true,
      metadata: { dialCode: `+8${i + 10}` },
    })),
  ]);

  await bumpCounters();

  return {
    doctors: individualDoctors.slice(0, 3).map((user) => user.email),
    corporate: corpAdmins.slice(0, 2).map((user) => user.email),
    staffSample: [
      staff.find((user) => user.role === 'coordinator')?.email,
      staff.find((user) => user.role === 'designer')?.email,
      staff.find((user) => user.role === 'qc')?.email,
    ].filter((email): email is string => Boolean(email)),
  };
}
