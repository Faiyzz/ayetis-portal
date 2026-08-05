import type {
  AccountType,
  AuthPayload,
  PublicUser,
  RegistrationListResult,
  RegistrationRequestDto,
  SystemMessages,
} from '@ayetis/shared';
import api from '@/lib/api';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  clinicName?: string;
  companyName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  accountType: AccountType;
}

export interface RegisterResult {
  message: string;
  registrationId: string;
  verifyUrl?: string;
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const { data } = await api.post('/auth/register', payload);
  return data.data;
}

export async function login(payload: LoginPayload): Promise<AuthPayload> {
  const { data } = await api.post('/auth/login', payload);
  return data.data;
}

export async function verifyEmail(token: string): Promise<{ message: string; status: string }> {
  const { data } = await api.post('/auth/verify-email', { token });
  return data.data;
}

export async function fetchMe(): Promise<PublicUser> {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function forgotPassword(
  email: string,
): Promise<{ message: string; confirmUrl?: string }> {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data.data;
}

export async function confirmPasswordReset(
  token: string,
): Promise<{ message: string; temporaryPassword?: string }> {
  const { data } = await api.post('/auth/confirm-password-reset', { token });
  return data.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string; user?: PublicUser }> {
  const { data } = await api.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data.data;
}

export async function fetchRegistrations(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<RegistrationListResult> {
  const { data } = await api.get('/registrations', { params });
  return data.data;
}

export async function approveRegistration(id: string): Promise<{
  registration: RegistrationRequestDto;
  user: PublicUser;
}> {
  const { data } = await api.post(`/registrations/${id}/approve`);
  return data.data;
}

export async function rejectRegistration(
  id: string,
  reason: string,
): Promise<RegistrationRequestDto> {
  const { data } = await api.post(`/registrations/${id}/reject`, { reason });
  return data.data;
}

export async function holdRegistration(id: string): Promise<RegistrationRequestDto> {
  const { data } = await api.post(`/registrations/${id}/hold`);
  return data.data;
}

export async function fetchSystemMessages(): Promise<SystemMessages> {
  const { data } = await api.get('/registrations/messages');
  return data.data;
}

export async function updateSystemMessages(
  messages: Partial<SystemMessages>,
): Promise<SystemMessages> {
  const { data } = await api.patch('/registrations/messages', messages);
  return data.data;
}
