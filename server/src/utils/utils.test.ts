import { describe, expect, it } from 'vitest';
import { addBusinessHours, computeSlaDeadline, elapsedBusinessHours, slaUtilizationPercent } from './businessHours';
import { AppError } from './AppError';
import { generateTemporaryPassword, pushPasswordHistory } from './password';
import { passwordSchema } from './passwordSchema';
import { escapeXml, toPrintHtml, toSpreadsheetMl } from './spreadsheet';
import { isPasswordComplex } from '@ayetis/shared';

describe('business hours SLA', () => {
  it('skips Saturday and Sunday when adding hours', () => {
    const fridayEvening = new Date(Date.UTC(2026, 0, 2, 22, 0, 0)); // Friday
    const deadline = addBusinessHours(fridayEvening, 4);
    expect(deadline.getUTCDay()).not.toBe(0);
    expect(deadline.getUTCDay()).not.toBe(6);
    expect(computeSlaDeadline(new Date(Date.UTC(2026, 0, 5, 9, 0, 0)), 48).getTime()).toBeGreaterThan(
      new Date(Date.UTC(2026, 0, 5, 9, 0, 0)).getTime(),
    );
  });

  it('computes elapsed hours and utilization', () => {
    const start = new Date(Date.UTC(2026, 0, 5, 0, 0, 0)); // Monday
    const now = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    expect(elapsedBusinessHours(start, now)).toBeGreaterThan(0);
    expect(elapsedBusinessHours(now, start)).toBe(0);
    const deadline = new Date(Date.UTC(2026, 0, 7, 0, 0, 0));
    expect(slaUtilizationPercent(start, deadline, now)).toBeGreaterThan(0);
    expect(slaUtilizationPercent(start, start, now)).toBe(100);
  });
});

describe('password helpers', () => {
  it('generates a complex temporary password', () => {
    const password = generateTemporaryPassword();
    expect(isPasswordComplex(password)).toBe(true);
    expect(passwordSchema.safeParse(password).success).toBe(true);
    expect(passwordSchema.safeParse('weak').success).toBe(false);
  });

  it('keeps password history at depth 5', () => {
    const user = { passwordHistory: ['a', 'b', 'c', 'd', 'e'] };
    pushPasswordHistory(user as never, 'new-hash');
    expect(user.passwordHistory[0]).toBe('new-hash');
    expect(user.passwordHistory).toHaveLength(5);
    pushPasswordHistory(user as never, undefined);
    expect(user.passwordHistory).toHaveLength(5);
  });
});

describe('errors and spreadsheets', () => {
  it('creates operational AppErrors', () => {
    const err = new AppError('Nope', 403, { field: 'x' }, 'CODE');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('CODE');
    expect(err.isOperational).toBe(true);
  });

  it('escapes XML and builds Excel/print documents', () => {
    expect(escapeXml('a&b<c>"')).toBe('a&amp;b&lt;c&gt;&quot;');
    const xml = toSpreadsheetMl('Pipeline', ['Case', 'Count'], [['AYT-1', 2]]);
    expect(xml).toContain('Excel.Sheet');
    expect(xml).toContain('AYT-1');
    const html = toPrintHtml({
      title: 'Doctors',
      subtitle: 'Q1',
      headers: ['Name', 'Rate'],
      rows: [['Ada', '50%']],
    });
    expect(html).toContain('Ada');
    expect(html).toContain('Print / Save as PDF');
  });
});
