/**
 * Business-hours helpers for URD SLA (excludes Saturdays and Sundays).
 * Uses UTC calendar days unless a future timezone config is added.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Advance `start` by `hours` of business time (skipping Sat/Sun). */
export function addBusinessHours(start: Date, hours: number): Date {
  if (hours <= 0) return new Date(start);

  let remainingMs = hours * MS_PER_HOUR;
  const cursor = new Date(start.getTime());

  // If starting on a weekend, jump to next Monday 00:00 UTC
  while (isWeekend(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }

  while (remainingMs > 0) {
    if (isWeekend(cursor)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
      continue;
    }

    const endOfDay = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1),
    );
    const available = endOfDay.getTime() - cursor.getTime();
    if (remainingMs <= available) {
      cursor.setTime(cursor.getTime() + remainingMs);
      remainingMs = 0;
    } else {
      remainingMs -= available;
      cursor.setTime(endOfDay.getTime());
    }
  }

  return cursor;
}

export function computeSlaDeadline(start: Date, businessHours: number): Date {
  return addBusinessHours(start, businessHours);
}

/** Elapsed business hours between start and now (approx via binary search on deadline). */
export function elapsedBusinessHours(start: Date, now = new Date()): number {
  if (now.getTime() <= start.getTime()) return 0;

  let lo = 0;
  let hi = Math.ceil((now.getTime() - start.getTime()) / MS_PER_HOUR) + 48;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = addBusinessHours(start, mid);
    if (candidate.getTime() < now.getTime()) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function slaUtilizationPercent(
  start: Date,
  deadline: Date,
  now = new Date(),
): number {
  const totalMs = deadline.getTime() - start.getTime();
  if (totalMs <= 0) return 100;
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(999, (elapsed / totalMs) * 100));
}
