import { PASSWORD_POLICY_DESCRIPTION } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { changePassword } from '@/features/auth/api';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const forced = Boolean(user?.mustChangePassword || user?.passwordExpired);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      const message = 'New passwords do not match.';
      setError(message);
      toast().warning(message);
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      toast().success(result.message);
      if (result.user && token) {
        setSession(result.user, token);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      if (forced) {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to change password');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <PageHeader
        title={forced ? 'Password update required' : 'Change password'}
        subtitle={
          forced
            ? user?.passwordExpired
              ? 'Your password has expired. Set a new one to continue.'
              : 'You must set a new password before using the portal.'
            : 'Update your password regularly to keep your account secure.'
        }
      />
      <p className="text-xs text-muted">{PASSWORD_POLICY_DESCRIPTION}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error ? <Alert>{error}</Alert> : null}

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

        <AuthButton loading={loading}>{forced ? 'Update and continue' : 'Save password'}</AuthButton>
      </form>
    </div>
  );
}
