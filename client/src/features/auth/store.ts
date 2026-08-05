import type { AccountType, PublicUser } from '@ayetis/shared';
import { create } from 'zustand';
import * as authApi from '@/features/auth/api';

const TOKEN_KEY = 'ayetis_token';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  isBootstrapping: boolean;
  setSession: (user: PublicUser, token: string) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string, accountType: AccountType) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isBootstrapping: true,

  setSession: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token });
  },

  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },

  bootstrap: async () => {
    const token = get().token;
    if (!token) {
      set({ isBootstrapping: false, user: null });
      return;
    }

    try {
      const user = await authApi.fetchMe();
      set({ user, isBootstrapping: false });
    } catch {
      get().clearSession();
      set({ isBootstrapping: false });
    }
  },

  login: async (email, password, accountType) => {
    const payload = await authApi.login({ email, password, accountType });
    get().setSession(payload.user, payload.tokens.accessToken);
  },

  logout: async () => {
    try {
      if (get().token) {
        await authApi.logout();
      }
    } catch {
      // Still clear local session even if audit logout fails.
    } finally {
      get().clearSession();
    }
  },
}));
