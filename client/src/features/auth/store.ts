import type { AccountType, PublicUser, ThemePreference } from '@ayetis/shared';
import { create } from 'zustand';
import * as authApi from '@/features/auth/api';
import { useThemeStore } from '@/features/theme/themeStore';

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
  setUser: (user: PublicUser) => void;
}

function syncThemeFromUser(user: PublicUser | null) {
  if (user?.themePreference) {
    useThemeStore.getState().hydrateFromUser(user.themePreference);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isBootstrapping: true,

  setSession: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    syncThemeFromUser(user);
    set({ user, token });
  },

  setUser: (user) => {
    syncThemeFromUser(user);
    set({ user });
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
      syncThemeFromUser(user);
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

export async function persistThemePreference(theme: ThemePreference): Promise<PublicUser | null> {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  const user = await authApi.updatePreferences({ themePreference: theme });
  useAuthStore.getState().setUser(user);
  return user;
}
