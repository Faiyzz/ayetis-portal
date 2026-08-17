import { ACCOUNT_STATUSES, ACCOUNT_TYPES, ROLES } from '@ayetis/shared';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { env } from '../config/env';
import { migrateCaseManagement } from '../models/migrateCaseManagement';
import { User } from '../models/User';
import { COUNT, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD } from './seed/constants';
import { initFaker } from './seed/factories';
import { seedDemo } from './seed/insert';

async function ensureAdmin(): Promise<void> {
  const existing = await User.findOne({ email: env.seedAdminEmail });
  if (existing) {
    console.log(`Admin already exists: ${env.seedAdminEmail}`);
    return;
  }

  await User.create({
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    firstName: 'System',
    lastName: 'Admin',
    role: ROLES.ADMIN,
    accountType: ACCOUNT_TYPES.INDIVIDUAL,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
  });

  console.log(`Seeded admin → ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
}

async function seed(): Promise<void> {
  initFaker();
  await connectDatabase();

  const { seedSettingsData } = await import('../features/settings/settings.service');
  await seedSettingsData();
  const { seedRoleDefinitions } = await import('../features/rbac/rbac.service');
  await seedRoleDefinitions();
  await migrateCaseManagement();

  await ensureAdmin();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const summary = await seedDemo(passwordHash);

  console.log(`\nDemo seed complete (${COUNT} rows per feature).`);
  console.log(`Demo password for all *@${DEMO_EMAIL_DOMAIN} users: ${DEMO_PASSWORD}`);
  console.log(`Doctors:        ${summary.doctors.join(', ')}`);
  console.log(`Corporate:      ${summary.corporate.join(', ')}`);
  console.log(`Staff:          ${summary.staffSample.join(', ')}`);
  console.log(`Registrations:  reg.01@${DEMO_EMAIL_DOMAIN} … reg.${COUNT}@${DEMO_EMAIL_DOMAIN}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
