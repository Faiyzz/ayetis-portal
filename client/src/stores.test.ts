import { describe, expect, it } from 'vitest';
import { THEMES } from '@ayetis/shared';
import { useThemeStore } from '@/features/theme/themeStore';
import { useToastStore } from '@/features/notifications/toastStore';
import { dialog, useDialogStore } from '@/components/dialog/dialogStore';
import { useCaseDetailNav } from '@/features/cases/caseDetailNav';
import { useAdminOrgStore } from '@/features/corporate/orgContext';

describe('client stores', () => {
  it('toggles light and dark theme', () => {
    useThemeStore.getState().setTheme(THEMES.LIGHT);
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe(THEMES.DARK);
    useThemeStore.getState().hydrateFromUser(THEMES.LIGHT);
    expect(useThemeStore.getState().theme).toBe(THEMES.LIGHT);
  });

  it('pushes and dismisses toasts', () => {
    const id = useToastStore.getState().success('Saved');
    expect(useToastStore.getState().toasts[0]?.message).toBe('Saved');
    useToastStore.getState().error('Nope');
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts.some((t) => t.id === id)).toBe(false);
  });

  it('opens prompt and alert dialogs', async () => {
    const promptPending = dialog.prompt({ title: 'Name?' });
    expect(useDialogStore.getState().dialog?.kind).toBe('prompt');
    useDialogStore.getState().dialog?.resolve('Ada' as never);
    await expect(promptPending).resolves.toBe('Ada');

    const alertPending = dialog.alert({ title: 'Done' });
    useDialogStore.getState().dialog?.resolve(undefined as never);
    await expect(alertPending).resolves.toBeUndefined();

    const pending = dialog.confirm({ title: 'Delete?' });
    expect(useDialogStore.getState().dialog?.kind).toBe('confirm');
    useDialogStore.getState().dialog?.resolve(true as never);
    await expect(pending).resolves.toBe(true);
  });

  it('tracks case detail nav and admin org picker', () => {
    useCaseDetailNav.getState().setNav('AYT-1', [{ id: 'overview', label: 'Overview' }]);
    expect(useCaseDetailNav.getState().caseId).toBe('AYT-1');
    useCaseDetailNav.getState().clear();
    expect(useCaseDetailNav.getState().sections).toEqual([]);

    useAdminOrgStore.getState().setOrganizationId('org-1');
    expect(sessionStorage.getItem('ayetis_admin_organization_id')).toBe('org-1');
    useAdminOrgStore.getState().clearOrganizationId();
    expect(useAdminOrgStore.getState().organizationId).toBe('');
  });
});
