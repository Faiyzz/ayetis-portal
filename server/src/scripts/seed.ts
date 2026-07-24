import { ROLES } from '@ayetis/shared';
import { connectDatabase } from '../config/database';
import { env } from '../config/env';
import { User } from '../models/User';

async function seed() {
  await connectDatabase();

  const existing = await User.findOne({ email: env.seedAdminEmail });
  if (existing) {
    console.log(`Admin already exists: ${env.seedAdminEmail}`);
    process.exit(0);
  }

  await User.create({
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    firstName: 'System',
    lastName: 'Admin',
    role: ROLES.ADMIN,
  });

  console.log(`Seeded admin → ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
