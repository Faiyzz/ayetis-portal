import crypto from 'crypto';
import { PASSWORD_POLICY } from '@ayetis/shared';
import type { IUser } from '../models/User';

/** Cryptographically random temp password that satisfies complexity policy. */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const picks = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  for (let i = picks.length; i < 12; i += 1) {
    picks.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }

  return picks.join('');
}

export function pushPasswordHistory(
  user: IUser,
  previousHash: string | undefined,
): void {
  if (!previousHash) return;
  const history = [...(user.passwordHistory ?? [])];
  history.unshift(previousHash);
  user.passwordHistory = history.slice(0, PASSWORD_POLICY.historyDepth);
}
