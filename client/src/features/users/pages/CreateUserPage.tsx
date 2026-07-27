import {
  ALL_ROLES,
  ROLE_LABELS,
  ROLES,
  type CreateUserInput,
  type Role,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

const INITIAL_FORM: CreateUserInput = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: ROLES.DESIGNER,
};

export function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateUserInput>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof CreateUserInput>(key: K, value: CreateUserInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await usersApi.createUser(form);
      navigate(`/app/users/${created.id}/permissions`, {
        replace: true,
        state: { created: true },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create user'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-5">
      <div>
        <Link to="/app/users" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Users
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Create user</h1>
        <p className="mt-2 text-[15px] text-muted">
          Register a team member for one of the fixed system roles. Permissions can be refined
          after creation.
        </p>
      </div>

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
          onChange={(e) => update('password', e.target.value)}
          placeholder="Min. 8 chars, mixed case + number"
        />

        <label className="block space-y-1.5" htmlFor="role">
          <span className="text-sm font-medium text-ink">Role</span>
          <select
            id="role"
            name="role"
            required
            value={form.role}
            onChange={(e) => update('role', e.target.value as Role)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            System roles only — new roles cannot be created. Default permissions come from the
            selected role; you can grant or deny extras next.
          </span>
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
