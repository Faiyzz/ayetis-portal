import {
  ACCOUNT_TYPES,
  EMPTY_COMPANY_ADDRESS,
  ORGANIZATION_STATUSES,
  ROLES,
} from '@ayetis/shared';
import { generateCorporateCustomerId } from './CorporateCounter';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Backfill Organization + corporateCustomerId for legacy corporate doctor accounts.
 * Promotes the earliest corporate doctor per companyName to corporate_admin when no admin exists.
 */
export async function migrateCorporateHierarchy() {
  const corporates = await User.find({
    accountType: ACCOUNT_TYPES.CORPORATE,
    $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
  }).sort({ createdAt: 1 });

  if (!corporates.length) return;

  const byCompany = new Map<string, typeof corporates>();
  for (const user of corporates) {
    const key = (user.companyName || user.email).trim().toLowerCase();
    const list = byCompany.get(key) ?? [];
    list.push(user);
    byCompany.set(key, list);
  }

  for (const [, users] of byCompany) {
    const owner = users[0]!;
    let org = owner.corporateCustomerId
      ? await Organization.findOne({ corporateCustomerId: owner.corporateCustomerId })
      : null;

    if (!org) {
      const corporateCustomerId = await generateCorporateCustomerId();
      org = await Organization.create({
        corporateCustomerId,
        companyName: owner.companyName || `${owner.firstName} ${owner.lastName}`.trim(),
        address: { ...EMPTY_COMPANY_ADDRESS },
        country: '',
        status: ORGANIZATION_STATUSES.ACTIVE,
        ownerUserId: owner._id,
        subAccountSeq: 0,
        employeeSeq: 0,
      });
    }

    for (let i = 0; i < users.length; i += 1) {
      const user = users[i]!;
      user.organizationId = org._id as never;
      user.corporateCustomerId = org.corporateCustomerId;
      user.companyName = org.companyName;
      if (i === 0 && user.role === ROLES.DOCTOR) {
        user.role = ROLES.CORPORATE_ADMIN;
        org.ownerUserId = user._id as never;
      }
      await user.save();
    }
    await org.save();
  }

  console.log(`[migrate] corporate hierarchy: processed ${corporates.length} user(s)`);
}
