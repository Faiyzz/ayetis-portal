import axios from 'axios';
import type { ApiResponse } from '@ayetis/shared';

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

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
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

export default api;
