import { useState, type FormEvent } from 'react';
import { changePassword } from '@/features/auth/api';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      setSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to change password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Change password</h1>
      <p className="mt-1 text-sm text-muted">
        Update your password regularly to keep your account secure.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <TextField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <TextField
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <TextField
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <AuthButton loading={loading}>Save new password</AuthButton>
      </form>
    </div>
  );
}
