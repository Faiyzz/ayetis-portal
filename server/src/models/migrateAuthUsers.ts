import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ROLES,
} from '@ayetis/shared';
import { generateDoctorId } from './DoctorCounter';
import { getSystemMessages } from './SystemConfig';
import { User } from './User';

/**
 * Migrate legacy users: isActive → accountStatus, assign missing doctorIds.
 * Safe to run on every startup (idempotent).
 */
export async function migrateAuthUsers(): Promise<void> {
  await getSystemMessages();

  await User.updateMany(
    { accountType: { $exists: false } },
    { $set: { accountType: ACCOUNT_TYPES.INDIVIDUAL } },
  );

  await User.updateMany(
    {
      $or: [{ accountStatus: { $exists: false } }, { accountStatus: null }],
      isActive: true,
    },
    { $set: { accountStatus: ACCOUNT_STATUSES.ACTIVE } },
  );

  await User.updateMany(
    {
      $or: [{ accountStatus: { $exists: false } }, { accountStatus: null }],
      isActive: false,
    },
    { $set: { accountStatus: ACCOUNT_STATUSES.BLOCKED } },
  );

  await User.updateMany(
    { passwordHistory: { $exists: false } },
    { $set: { passwordHistory: [] } },
  );

  const doctorsMissingId = await User.find({
    role: ROLES.DOCTOR,
    $or: [{ doctorId: { $exists: false } }, { doctorId: null }, { doctorId: '' }],
  });

  for (const doctor of doctorsMissingId) {
    doctor.doctorId = await generateDoctorId();
    await doctor.save();
  }
}
