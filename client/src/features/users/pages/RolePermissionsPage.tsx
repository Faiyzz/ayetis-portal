import {
  ALL_ASSIGNMENT_QUEUES,
  ALL_EXPERIENCE_LEVELS,
  ALL_PORTAL_TEMPLATES,
  ALL_QC_SCOPES,
  ASSIGNMENT_QUEUE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  PERMISSIONS,
  PORTAL_TEMPLATES,
  QC_SCOPE_LABELS,
  toRbacMatrixGroup,
  type AssignmentQueue,
  type AssignmentRuleDto,
  type ExperienceLevel,
  type Permission,
  type PermissionCatalogItem,
  type PortalTemplate,
  type QcScope,
  type RoleDefinitionDto,
  type TeamDto,
  type CountryDto,
  type RegionDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import * as rbacApi from '@/features/rbac/api';
import { fetchCountries, fetchRegions } from '@/features/settings/api';
import { PermissionEditor } from '@/features/users/components/PermissionEditor';
import { getErrorMessage } from '@/lib/api';

type Tab = 'roles' | 'matrix' | 'teams' | 'rules';

const EMPTY_ROLE = {
  key: '',
  name: '',
  description: '',
  portalTemplate: PORTAL_TEMPLATES.DESIGNER as PortalTemplate,
  qcScope: 'none' as QcScope,
};

const EMPTY_TEAM = {
  id: '',
  name: '',
  code: '',
  memberIds: '',
  regionIds: [] as string[],
  isActive: true,
};

const EMPTY_RULE = {
  id: '',
  name: '',
  targetQueue: 'designer' as AssignmentQueue,
  roleKeys: '',
  teamIds: '',
  regionIds: [] as string[],
  countryIds: [] as string[],
  excludedCountryIds: [] as string[],
  experienceLevels: [] as ExperienceLevel[],
  softwareKeys: '',
  requireAvailable: true,
  maxOpenCases: '',
  weight: '1',
  isActive: true,
};

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleId(list: string[], id: string, checked: boolean) {
  return checked ? [...new Set([...list, id])] : list.filter((item) => item !== id);
}

function IdChecklist({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="max-h-40 overflow-y-auto rounded-xl border border-line p-2">
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted">No options.</p>
        ) : (
          options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={(e) => onChange(toggleId(selected, opt.id, e.target.checked))}
              />
              {opt.name}
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}

function remapCatalog(
  catalog: Array<{ value: Permission; label: string; group: string }>,
): PermissionCatalogItem[] {
  return catalog.map((item) => ({
    ...item,
    group: toRbacMatrixGroup(item.group),
  }));
}

export function RolePermissionsPage() {
  const { can } = usePermissions();
  const canViewRoles = can(PERMISSIONS.ROLE_VIEW_PERMISSIONS);
  const canManageRoles = can(PERMISSIONS.ROLE_MANAGE);
  const canAssignPermissions = can(PERMISSIONS.ROLE_ASSIGN_PERMISSIONS);
  const canTeams = can(PERMISSIONS.TEAM_MANAGE);
  const canRules = can(PERMISSIONS.ASSIGNMENT_RULE_MANAGE);

  const firstTab: Tab = canViewRoles
    ? 'roles'
    : canTeams
      ? 'teams'
      : canRules
        ? 'rules'
        : 'matrix';

  const [tab, setTab] = useState<Tab>(firstTab);
  const [roles, setRoles] = useState<RoleDefinitionDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [rules, setRules] = useState<AssignmentRuleDto[]>([]);
  const [matrixCatalog, setMatrixCatalog] = useState<PermissionCatalogItem[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [grants, setGrants] = useState<Permission[]>([]);
  const [denies, setDenies] = useState<Permission[]>([]);
  const [roleForm, setRoleForm] = useState({ ...EMPTY_ROLE, editingKey: '' as string });
  const [cloneForm, setCloneForm] = useState({ sourceKey: '', name: '', key: '' });
  const [teamForm, setTeamForm] = useState({ ...EMPTY_TEAM });
  const [ruleForm, setRuleForm] = useState({ ...EMPTY_RULE });
  const [regions, setRegions] = useState<RegionDto[]>([]);
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.key === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );

  async function loadRoles() {
    if (!canViewRoles) return;
    const list = await rbacApi.fetchRoleDefinitions();
    setRoles(list);
    if (!selectedRoleKey && list[0]) {
      selectRole(list[0]);
    } else if (selectedRoleKey) {
      const current = list.find((role) => role.key === selectedRoleKey);
      if (current) selectRole(current);
    }
  }

  async function loadTeams() {
    if (!canTeams) return;
    setTeams(await rbacApi.fetchTeams());
  }

  async function loadRules() {
    if (!canRules) return;
    setRules(await rbacApi.fetchAssignmentRules());
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        loadRoles(),
        loadTeams(),
        loadRules(),
        fetchRegions().then(setRegions).catch(() => setRegions([])),
        fetchCountries(true).then(setCountries).catch(() => setCountries([])),
      ]);
      if (canViewRoles) {
        const matrix = await rbacApi.fetchPermissionMatrix();
        setMatrixCatalog(remapCatalog(matrix.permissions));
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load roles & permissions');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectRole(role: RoleDefinitionDto) {
    setSelectedRoleKey(role.key);
    setGrants(role.permissionGrants);
    setDenies(role.permissionDenies);
  }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    if (!canManageRoles) return;
    setSaving(true);
    try {
      if (roleForm.editingKey) {
        await rbacApi.updateRole(roleForm.editingKey, {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
          portalTemplate: roleForm.portalTemplate,
          qcScope: roleForm.qcScope,
        });
        toast().success('Role updated');
      } else {
        await rbacApi.createRole({
          key: roleForm.key.trim() || undefined,
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
          portalTemplate: roleForm.portalTemplate,
          qcScope: roleForm.qcScope,
        });
        toast().success('Role created');
      }
      setRoleForm({ ...EMPTY_ROLE, editingKey: '' });
      await loadRoles();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save role'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoleDisabled(role: RoleDefinitionDto) {
    if (!canManageRoles) return;
    setSaving(true);
    try {
      await rbacApi.updateRole(role.key, { isDisabled: !role.isDisabled });
      toast().success(role.isDisabled ? 'Role enabled' : 'Role disabled');
      await loadRoles();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update role'));
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(role: RoleDefinitionDto) {
    if (!canManageRoles || role.isSystem) return;
    if (!window.confirm(`Delete custom role "${role.name}"?`)) return;
    setSaving(true);
    try {
      await rbacApi.deleteRole(role.key);
      toast().success('Role deleted');
      if (selectedRoleKey === role.key) setSelectedRoleKey(null);
      await loadRoles();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to delete role'));
    } finally {
      setSaving(false);
    }
  }

  async function doClone(event: FormEvent) {
    event.preventDefault();
    if (!canManageRoles || !cloneForm.sourceKey) return;
    setSaving(true);
    try {
      await rbacApi.cloneRole(cloneForm.sourceKey, {
        name: cloneForm.name.trim(),
        key: cloneForm.key.trim() || undefined,
      });
      toast().success('Role cloned');
      setCloneForm({ sourceKey: '', name: '', key: '' });
      await loadRoles();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to clone role'));
    } finally {
      setSaving(false);
    }
  }

  async function moveRole(index: number, direction: -1 | 1) {
    if (!canManageRoles) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= roles.length) return;
    const keys = roles.map((role) => role.key);
    [keys[index], keys[nextIndex]] = [keys[nextIndex], keys[index]];
    setSaving(true);
    try {
      const reordered = await rbacApi.reorderRoles(keys);
      setRoles(reordered);
      toast().success('Role order updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to reorder roles'));
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions() {
    if (!selectedRole || !canAssignPermissions) return;
    setSaving(true);
    try {
      const updated = await rbacApi.updateRolePermissions(
        selectedRole.key,
        grants,
        denies,
      );
      setRoles((prev) => prev.map((role) => (role.key === updated.key ? updated : role)));
      setGrants(updated.permissionGrants);
      setDenies(updated.permissionDenies);
      toast().success(`${updated.name} permissions saved`);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save permissions'));
    } finally {
      setSaving(false);
    }
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    if (!canTeams) return;
    setSaving(true);
    try {
      const payload = {
        name: teamForm.name.trim(),
        code: teamForm.code.trim() || null,
        memberIds: parseCsv(teamForm.memberIds),
        regionIds: teamForm.regionIds,
        isActive: teamForm.isActive,
      };
      if (teamForm.id) {
        await rbacApi.patchTeam(teamForm.id, payload);
        toast().success('Team updated');
      } else {
        await rbacApi.upsertTeam(payload);
        toast().success('Team created');
      }
      setTeamForm({ ...EMPTY_TEAM });
      await loadTeams();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save team'));
    } finally {
      setSaving(false);
    }
  }

  async function removeTeam(id: string) {
    if (!canTeams || !window.confirm('Delete this team?')) return;
    setSaving(true);
    try {
      await rbacApi.deleteTeam(id);
      toast().success('Team deleted');
      await loadTeams();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to delete team'));
    } finally {
      setSaving(false);
    }
  }

  async function saveRule(event: FormEvent) {
    event.preventDefault();
    if (!canRules) return;
    setSaving(true);
    try {
      const payload = {
        name: ruleForm.name.trim(),
        targetQueue: ruleForm.targetQueue,
        roleKeys: parseCsv(ruleForm.roleKeys),
        teamIds: parseCsv(ruleForm.teamIds),
        regionIds: ruleForm.regionIds,
        countryIds: ruleForm.countryIds,
        excludedCountryIds: ruleForm.excludedCountryIds,
        experienceLevels: ruleForm.experienceLevels,
        softwareKeys: parseCsv(ruleForm.softwareKeys),
        requireAvailable: ruleForm.requireAvailable,
        maxOpenCases: ruleForm.maxOpenCases ? Number(ruleForm.maxOpenCases) : null,
        weight: Number(ruleForm.weight) || 1,
        isActive: ruleForm.isActive,
      };
      if (ruleForm.id) {
        await rbacApi.patchAssignmentRule(ruleForm.id, payload);
        toast().success('Rule updated');
      } else {
        await rbacApi.upsertAssignmentRule(payload);
        toast().success('Rule created');
      }
      setRuleForm({ ...EMPTY_RULE });
      await loadRules();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save assignment rule'));
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    if (!canRules || !window.confirm('Delete this assignment rule?')) return;
    setSaving(true);
    try {
      await rbacApi.deleteAssignmentRule(id);
      toast().success('Rule deleted');
      await loadRules();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to delete rule'));
    } finally {
      setSaving(false);
    }
  }

  async function moveRule(index: number, direction: -1 | 1) {
    if (!canRules) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rules.length) return;
    const ids = rules.map((rule) => rule.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    setSaving(true);
    try {
      const reordered = await rbacApi.reorderAssignmentRules(ids);
      setRules(reordered);
      toast().success('Rule priority updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to reorder rules'));
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'roles', label: 'Roles', show: canViewRoles },
    { id: 'matrix', label: 'Matrix', show: canViewRoles },
    { id: 'teams', label: 'Teams', show: canTeams },
    { id: 'rules', label: 'Assignment rules', show: canRules },
  ];

  const canEditMatrix =
    canAssignPermissions && selectedRole && !selectedRole.locked && !selectedRole.isDisabled;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        subtitle="Role definitions, permission matrix, teams, and auto-assignment rules."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'rounded-lg px-3.5 py-2 text-sm font-semibold',
                tab === t.id ? 'bg-brand-500 text-white' : 'border border-line text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
      </div>

      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {tab === 'roles' && canViewRoles ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          {canManageRoles ? (
            <form onSubmit={saveRole} className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">
                {roleForm.editingKey ? 'Edit role' : 'New role'}
              </h2>
              {!roleForm.editingKey ? (
                <TextField
                  label="Key (optional)"
                  name="key"
                  value={roleForm.key}
                  onChange={(e) => setRoleForm((p) => ({ ...p, key: e.target.value }))}
                  placeholder="auto-generated from name"
                />
              ) : null}
              <TextField
                label="Name"
                name="name"
                value={roleForm.name}
                onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <TextField
                label="Description"
                name="description"
                value={roleForm.description}
                onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Portal template</span>
                <select
                  value={roleForm.portalTemplate}
                  onChange={(e) =>
                    setRoleForm((p) => ({
                      ...p,
                      portalTemplate: e.target.value as PortalTemplate,
                    }))
                  }
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  {ALL_PORTAL_TEMPLATES.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">QC scope</span>
                <select
                  value={roleForm.qcScope}
                  onChange={(e) =>
                    setRoleForm((p) => ({ ...p, qcScope: e.target.value as QcScope }))
                  }
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  {ALL_QC_SCOPES.map((value) => (
                    <option key={value} value={value}>
                      {QC_SCOPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <AuthButton loading={saving}>
                {roleForm.editingKey ? 'Update role' : 'Create role'}
              </AuthButton>
              {roleForm.editingKey ? (
                <button
                  type="button"
                  className="text-sm text-muted hover:text-ink"
                  onClick={() => setRoleForm({ ...EMPTY_ROLE, editingKey: '' })}
                >
                  Cancel edit
                </button>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-muted">You can view roles but not create or edit them.</p>
          )}

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Portal / QC</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {roles.map((role, index) => (
                  <tr key={role.key} className={role.isDisabled ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{role.name}</p>
                      <p className="text-xs text-muted">
                        {role.key}
                        {role.isSystem ? ' · system' : ' · custom'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {role.portalTemplate} · {QC_SCOPE_LABELS[role.qcScope]}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {role.isDisabled ? 'Disabled' : role.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canManageRoles ? (
                          <>
                            <button
                              type="button"
                              disabled={index === 0}
                              className="text-xs font-medium text-brand-600 disabled:opacity-40"
                              onClick={() => void moveRole(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === roles.length - 1}
                              className="text-xs font-medium text-brand-600 disabled:opacity-40"
                              onClick={() => void moveRole(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600"
                              onClick={() =>
                                setRoleForm({
                                  editingKey: role.key,
                                  key: role.key,
                                  name: role.name,
                                  description: role.description ?? '',
                                  portalTemplate: role.portalTemplate,
                                  qcScope: role.qcScope,
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600"
                              onClick={() =>
                                setCloneForm({
                                  sourceKey: role.key,
                                  name: `${role.name} copy`,
                                  key: '',
                                })
                              }
                            >
                              Clone
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600"
                              onClick={() => void toggleRoleDisabled(role)}
                            >
                              {role.isDisabled ? 'Enable' : 'Disable'}
                            </button>
                            {!role.isSystem ? (
                              <button
                                type="button"
                                className="text-xs font-medium text-red-600"
                                onClick={() => void removeRole(role)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-600"
                          onClick={() => {
                            selectRole(role);
                            setTab('matrix');
                          }}
                        >
                          Matrix
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {canManageRoles && cloneForm.sourceKey ? (
            <form
              onSubmit={doClone}
              className="col-span-full space-y-3 rounded-xl border border-line bg-white p-4 lg:max-w-md"
            >
              <h2 className="text-sm font-semibold text-ink">Clone role</h2>
              <TextField
                label="New name"
                name="cloneName"
                value={cloneForm.name}
                onChange={(e) => setCloneForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <TextField
                label="New key (optional)"
                name="cloneKey"
                value={cloneForm.key}
                onChange={(e) => setCloneForm((p) => ({ ...p, key: e.target.value }))}
              />
              <div className="flex gap-2">
                <AuthButton loading={saving}>Clone</AuthButton>
                <button
                  type="button"
                  className="text-sm text-muted"
                  onClick={() => setCloneForm({ sourceKey: '', name: '', key: '' })}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === 'matrix' && canViewRoles ? (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-line bg-white p-2">
            {roles.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => selectRole(role)}
                className={[
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                  selectedRoleKey === role.key
                    ? 'bg-brand-500 text-white'
                    : 'text-ink hover:bg-brand-50',
                ].join(' ')}
              >
                <span className="font-medium">{role.name}</span>
                <span
                  className={selectedRoleKey === role.key ? 'text-white/80' : 'text-muted'}
                >
                  {role.effective.length}
                </span>
              </button>
            ))}
          </aside>

          <div className="space-y-4">
            {selectedRole ? (
              <>
                <div className="rounded-2xl border border-line bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink">{selectedRole.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {selectedRole.defaults.length} defaults · +{selectedRole.permissionGrants.length}{' '}
                    grants · −{selectedRole.permissionDenies.length} denies ·{' '}
                    {selectedRole.effective.length} effective
                  </p>
                </div>

                <PermissionEditor
                  catalog={matrixCatalog}
                  roleDefaults={selectedRole.defaults}
                  grants={grants}
                  denies={denies}
                  locked={!canEditMatrix}
                  lockedMessage={
                    selectedRole.locked
                      ? 'This role is locked and cannot be customized.'
                      : selectedRole.isDisabled
                        ? 'Enable the role before editing permissions.'
                        : 'You do not have permission to edit role permissions.'
                  }
                  onChange={({ grants: nextGrants, denies: nextDenies }) => {
                    setGrants(nextGrants);
                    setDenies(nextDenies);
                  }}
                />

                {canEditMatrix ? (
                  <div className="max-w-xs">
                    <AuthButton loading={saving} type="button" onClick={() => void savePermissions()}>
                      Save permissions
                    </AuthButton>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'teams' && canTeams ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={saveTeam} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">
              {teamForm.id ? 'Edit team' : 'New team'}
            </h2>
            <TextField
              label="Name"
              name="teamName"
              value={teamForm.name}
              onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <TextField
              label="Code"
              name="teamCode"
              value={teamForm.code}
              onChange={(e) => setTeamForm((p) => ({ ...p, code: e.target.value }))}
            />
            <TextField
              label="Member IDs (comma-separated)"
              name="memberIds"
              value={teamForm.memberIds}
              onChange={(e) => setTeamForm((p) => ({ ...p, memberIds: e.target.value }))}
            />
            <IdChecklist
              label="Regions"
              options={regions.map((region) => ({ id: region.id, name: `${region.name} (${region.code})` }))}
              selected={teamForm.regionIds}
              onChange={(regionIds) => setTeamForm((p) => ({ ...p, regionIds }))}
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={teamForm.isActive}
                onChange={(e) => setTeamForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <AuthButton loading={saving}>{teamForm.id ? 'Update' : 'Create'}</AuthButton>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Regions</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{team.name}</p>
                      <p className="text-xs text-muted">{team.code ?? team.id}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {team.regionIds
                        .map((id) => regions.find((region) => region.id === id)?.code ?? id)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{team.memberIds.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 font-medium text-brand-600"
                        onClick={() =>
                          setTeamForm({
                            id: team.id,
                            name: team.name,
                            code: team.code ?? '',
                            memberIds: team.memberIds.join(', '),
                            regionIds: team.regionIds,
                            isActive: team.isActive,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="font-medium text-red-600"
                        onClick={() => void removeTeam(team.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === 'rules' && canRules ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={saveRule} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">
              {ruleForm.id ? 'Edit rule' : 'New assignment rule'}
            </h2>
            <TextField
              label="Name"
              name="ruleName"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Target queue</span>
              <select
                value={ruleForm.targetQueue}
                onChange={(e) =>
                  setRuleForm((p) => ({
                    ...p,
                    targetQueue: e.target.value as AssignmentQueue,
                  }))
                }
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {ALL_ASSIGNMENT_QUEUES.map((value) => (
                  <option key={value} value={value}>
                    {ASSIGNMENT_QUEUE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Role keys (comma-separated)"
              name="roleKeys"
              value={ruleForm.roleKeys}
              onChange={(e) => setRuleForm((p) => ({ ...p, roleKeys: e.target.value }))}
            />
            <TextField
              label="Team IDs (comma-separated)"
              name="teamIds"
              value={ruleForm.teamIds}
              onChange={(e) => setRuleForm((p) => ({ ...p, teamIds: e.target.value }))}
            />
            <IdChecklist
              label="Regions"
              options={regions.map((region) => ({ id: region.id, name: `${region.name} (${region.code})` }))}
              selected={ruleForm.regionIds}
              onChange={(regionIds) => setRuleForm((p) => ({ ...p, regionIds }))}
            />
            <IdChecklist
              label="Countries"
              options={countries.map((country) => ({ id: country.id, name: country.name }))}
              selected={ruleForm.countryIds}
              onChange={(countryIds) => setRuleForm((p) => ({ ...p, countryIds }))}
            />
            <IdChecklist
              label="Excluded countries"
              options={countries.map((country) => ({ id: country.id, name: country.name }))}
              selected={ruleForm.excludedCountryIds}
              onChange={(excludedCountryIds) => setRuleForm((p) => ({ ...p, excludedCountryIds }))}
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Experience levels</span>
              <div className="flex flex-wrap gap-3">
                {ALL_EXPERIENCE_LEVELS.map((level) => (
                  <label key={level} className="flex items-center gap-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={ruleForm.experienceLevels.includes(level)}
                      onChange={(e) =>
                        setRuleForm((p) => ({
                          ...p,
                          experienceLevels: e.target.checked
                            ? [...p.experienceLevels, level]
                            : p.experienceLevels.filter((item) => item !== level),
                        }))
                      }
                    />
                    {EXPERIENCE_LEVEL_LABELS[level]}
                  </label>
                ))}
              </div>
            </label>
            <TextField
              label="Software keys (comma-separated)"
              name="softwareKeys"
              value={ruleForm.softwareKeys}
              onChange={(e) => setRuleForm((p) => ({ ...p, softwareKeys: e.target.value }))}
            />
            <TextField
              label="Max open cases (optional)"
              name="maxOpenCases"
              type="number"
              value={ruleForm.maxOpenCases}
              onChange={(e) => setRuleForm((p) => ({ ...p, maxOpenCases: e.target.value }))}
            />
            <TextField
              label="Weight"
              name="weight"
              type="number"
              value={ruleForm.weight}
              onChange={(e) => setRuleForm((p) => ({ ...p, weight: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ruleForm.requireAvailable}
                onChange={(e) =>
                  setRuleForm((p) => ({ ...p, requireAvailable: e.target.checked }))
                }
              />
              Require available
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ruleForm.isActive}
                onChange={(e) => setRuleForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <AuthButton loading={saving}>{ruleForm.id ? 'Update' : 'Create'}</AuthButton>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Rule</th>
                  <th className="px-4 py-3 font-medium">Queue</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rules.map((rule, index) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          className="text-brand-600 disabled:opacity-40"
                          onClick={() => void moveRule(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === rules.length - 1}
                          className="text-brand-600 disabled:opacity-40"
                          onClick={() => void moveRule(index, 1)}
                        >
                          ↓
                        </button>
                        <span className="text-muted">{rule.priority}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{rule.name}</p>
                      <p className="text-xs text-muted">
                        {rule.isActive ? 'Active' : 'Inactive'} · weight {rule.weight}
                      </p>
                    </td>
                    <td className="px-4 py-3">{ASSIGNMENT_QUEUE_LABELS[rule.targetQueue]}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 font-medium text-brand-600"
                        onClick={() =>
                          setRuleForm({
                            id: rule.id,
                            name: rule.name,
                            targetQueue: rule.targetQueue,
                            roleKeys: rule.roleKeys.join(', '),
                            teamIds: rule.teamIds.join(', '),
                            regionIds: rule.regionIds,
                            countryIds: rule.countryIds,
                            excludedCountryIds: rule.excludedCountryIds,
                            experienceLevels: rule.experienceLevels,
                            softwareKeys: rule.softwareKeys.join(', '),
                            requireAvailable: rule.requireAvailable,
                            maxOpenCases:
                              rule.maxOpenCases != null ? String(rule.maxOpenCases) : '',
                            weight: String(rule.weight),
                            isActive: rule.isActive,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="font-medium text-red-600"
                        onClick={() => void removeRule(rule.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}
