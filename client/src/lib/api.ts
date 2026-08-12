import axios from 'axios';
import {
  PASSWORD_VALIDATION_FAILED,
  type ApiResponse,
} from '@ayetis/shared';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ayetis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type FlattenedErrors = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

function readFlattenedErrors(error: unknown): FlattenedErrors | null {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data as { errors?: FlattenedErrors } | undefined;
  if (!data?.errors || typeof data.errors !== 'object') return null;
  return data.errors;
}

export function getFieldError(error: unknown, field: string): string | undefined {
  const first = readFlattenedErrors(error)?.fieldErrors?.[field]?.[0];
  return first || undefined;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | (ApiResponse<unknown> & { code?: string })
      | undefined;
    const fieldErrors = readFlattenedErrors(error)?.fieldErrors;
    if (fieldErrors?.password?.length || fieldErrors?.newPassword?.length) {
      return PASSWORD_VALIDATION_FAILED;
    }
    if (data && data.success === false && data.message) {
      return data.message;
    }
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { code?: string } | undefined;
    return data?.code;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export default api;
