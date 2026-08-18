import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES } from '@ayetis/shared';
import {
  applyTriState,
  getTriState,
  groupCatalog,
  isDefaultOwned,
  roleDefaultsFor,
} from './permissionState';

describe('permission tri-state editor', () => {
  it('toggles grant and deny without overlap', () => {
    expect(getTriState(PERMISSIONS.REPORT_VIEW, [], [])).toBe('default');
    expect(getTriState(PERMISSIONS.REPORT_VIEW, [PERMISSIONS.REPORT_VIEW], [])).toBe('grant');
    expect(getTriState(PERMISSIONS.REPORT_VIEW, [], [PERMISSIONS.REPORT_VIEW])).toBe('deny');

    const granted = applyTriState(PERMISSIONS.REPORT_VIEW, 'grant', [], [PERMISSIONS.REPORT_VIEW]);
    expect(granted.grants).toContain(PERMISSIONS.REPORT_VIEW);
    expect(granted.denies).not.toContain(PERMISSIONS.REPORT_VIEW);

    const denied = applyTriState(PERMISSIONS.REPORT_VIEW, 'deny', [PERMISSIONS.REPORT_VIEW], []);
    expect(denied.denies).toContain(PERMISSIONS.REPORT_VIEW);
    expect(denied.grants).not.toContain(PERMISSIONS.REPORT_VIEW);
  });

  it('groups catalog items and reads role defaults', () => {
    const grouped = groupCatalog([
      { value: PERMISSIONS.CASE_CREATE, label: 'Create', group: 'Cases' },
      { value: PERMISSIONS.USER_LIST, label: 'List', group: 'Users' },
    ]);
    expect(grouped).toHaveLength(2);
    expect(isDefaultOwned(roleDefaultsFor(ROLES.DOCTOR), PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(isDefaultOwned(roleDefaultsFor(ROLES.DOCTOR), PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });
});
