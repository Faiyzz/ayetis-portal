import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (input: {
    tone: ToastTone;
    message: string;
    title?: string;
    durationMs?: number;
  }) => string;
  dismiss: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
}

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 4500,
  error: 5500,
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: ({ tone, message, title, durationMs }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastItem = {
      id,
      tone,
      title,
      message,
      durationMs: durationMs ?? DEFAULT_DURATION[tone],
    };

    set((state) => ({
      toasts: [...state.toasts, toast].slice(-4),
    }));

    return id;
  },

  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  success: (message, title = 'Success') => get().push({ tone: 'success', message, title }),
  error: (message, title = 'Error') => get().push({ tone: 'error', message, title }),
  info: (message, title = 'Info') => get().push({ tone: 'info', message, title }),
  warning: (message, title = 'Warning') => get().push({ tone: 'warning', message, title }),
}));

export function toast() {
  return useToastStore.getState();
}
