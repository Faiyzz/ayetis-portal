import type { AuthPayload, PublicUser } from '@ayetis/shared';
import api from '@/lib/api';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function register(payload: RegisterPayload): Promise<AuthPayload> {
  const { data } = await api.post('/auth/register', payload);
  return data.data;
}

export async function login(payload: LoginPayload): Promise<AuthPayload> {
  const { data } = await api.post('/auth/login', payload);
  return data.data;
}

export async function fetchMe(): Promise<PublicUser> {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function forgotPassword(email: string): Promise<{ message: string; resetUrl?: string }> {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data.data;
}

export async function resetPassword(token: string, password: string): Promise<AuthPayload> {
  const { data } = await api.post('/auth/reset-password', { token, password });
  return data.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const { data } = await api.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data.data;
}
