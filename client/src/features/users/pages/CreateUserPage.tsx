import {
  ALL_EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  PASSWORD_POLICY_DESCRIPTION,
  PASSWORD_VALIDATION_FAILED,
  ROLES,
  getRoleLabel,
  validatePasswordComplexity,
  type CreateUserInput,
  type ExperienceLevel,
  type RoleDefinitionDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { toast } from '@/features/notifications/toastStore';
import { fetchRoleDefinitions } from '@/features/rbac/api';
import * as usersApi from '@/features/users/api';
import { getErrorMessage, getFieldError } from '@/lib/api';

const INITIAL_FORM: CreateUserInput = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: ROLES.DESIGNER,
  primaryRole: ROLES.DESIGNER,
  roles: [ROLES.DESIGNER],
  isAvailable: true,
  softwareExpertise: [],
};

export function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateUserInput>(INITIAL_FORM);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinitionDto[]>([]);
  const [softwareText, setSoftwareText] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchRoleDefinitions()
      .then((roles) => setRoleDefinitions(roles.filter((role) => role.isActive && !role.isDisabled)))
      .catch(() => {
        /* roles API may be unavailable; fall back to primary role only */
      });
  }, []);

  function update<K extends keyof CreateUserInput>(key: K, value: CreateUserInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleRole(roleKey: string) {
    const current = form.roles ?? [form.primaryRole ?? form.role];
    const next = current.includes(roleKey)
      ? current.filter((key) => key !== roleKey)
      : [...current, roleKey];
    if (next.length === 0) return;
    const primaryRole = form.primaryRole ?? form.role;
    update('roles', next);
    update('role', primaryRole);
    if (!next.includes(primaryRole)) {
      update('primaryRole', next[0]);
      update('role', next[0]);
    }
  }

  function setPrimaryRole(roleKey: string) {
    const current = form.roles ?? [form.role];
    const roles = current.includes(roleKey) ? current : [...current, roleKey];
    update('primaryRole', roleKey);
    update('role', roleKey);
    update('roles', roles);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPasswordError('');
    const passwordIssues = validatePasswordComplexity(form.password);
    if (passwordIssues.length) {
      setPasswordError(PASSWORD_VALIDATION_FAILED);
      setError(PASSWORD_VALIDATION_FAILED);
      toast().error(PASSWORD_VALIDATION_FAILED);
      return;
    }
    setLoading(true);
    try {
      const roles = form.roles?.length ? form.roles : [form.primaryRole ?? form.role];
      const primaryRole = form.primaryRole ?? roles[0] ?? form.role;
      const created = await usersApi.createUser({
        ...form,
        role: primaryRole,
        primaryRole,
        roles,
        softwareExpertise: softwareText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toast().success(`${created.email} created`, 'User created');
      navigate(`/app/users/${created.id}/permissions`, {
        replace: true,
        state: { created: true },
      });
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create user');
      if (getFieldError(err, 'password')) setPasswordError(PASSWORD_VALIDATION_FAILED);
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  const activeRoles = roleDefinitions.length
    ? roleDefinitions
    : [{ key: form.role, name: getRoleLabel(form.role) } as RoleDefinitionDto];
  const selectedRoles = form.roles ?? [form.primaryRole ?? form.role];

  return (
    <div className="w-full max-w-xl space-y-5">
      <PageHeader
        eyebrow={
          <Link to="/app/users" className="hover:text-brand-700">
            ← Users
          </Link>
        }
        title="Create user"
        subtitle="Register a team member with one primary role and optional additional roles."
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-6"
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="First name"
            name="firstName"
            required
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Alex"
          />
          <TextField
            label="Last name"
            name="lastName"
            required
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Chen"
          />
        </div>

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="alex@ayetis.com"
        />

        <TextField
          label="Temporary password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(e) => {
            update('password', e.target.value);
            setPasswordError('');
          }}
          hint={PASSWORD_POLICY_DESCRIPTION}
          error={passwordError}
        />

        <label className="block space-y-1.5" htmlFor="primaryRole">
          <span className="text-sm font-medium text-ink">Primary role</span>
          <select
            id="primaryRole"
            name="primaryRole"
            required
            value={form.primaryRole ?? form.role}
            onChange={(e) => setPrimaryRole(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            {activeRoles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Additional roles</legend>
          <div className="flex flex-wrap gap-3">
            {activeRoles.map((role) => (
              <label key={role.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.key)}
                  onChange={() => toggleRole(role.key)}
                />
                {role.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1.5" htmlFor="experienceLevel">
          <span className="text-sm font-medium text-ink">Experience level</span>
          <select
            id="experienceLevel"
            name="experienceLevel"
            value={form.experienceLevel ?? ''}
            onChange={(e) =>
              update('experienceLevel', (e.target.value || null) as ExperienceLevel | null)
            }
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink"
          >
            <option value="">Not set</option>
            {ALL_EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </label>

        <TextField
          label="Software expertise (comma-separated)"
          name="softwareExpertise"
          value={softwareText}
          onChange={(e) => setSoftwareText(e.target.value)}
          placeholder="exocad, 3shape"
        />

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isAvailable ?? true}
            onChange={(e) => update('isAvailable', e.target.checked)}
          />
          Available for assignment
        </label>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:max-w-md">
          <AuthButton loading={loading}>Create user</AuthButton>
          <Link
            to="/app/users"
            className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-center text-[15px] font-semibold text-muted hover:bg-surface hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
