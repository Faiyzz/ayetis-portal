import { THEMES, type ThemePreference } from '@ayetis/shared';
import { create } from 'zustand';

const THEME_KEY = 'ayetis_theme';

function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === THEMES.DARK || raw === THEMES.LIGHT) return raw;
  } catch {
    // ignore
  }
  return THEMES.LIGHT;
}

function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === THEMES.DARK ? 'dark' : 'light';
}

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  hydrateFromUser: (theme: ThemePreference | null | undefined) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStoredTheme();
  applyThemeToDocument(initial);

  return {
    theme: initial,

    setTheme: (theme) => {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // ignore
      }
      applyThemeToDocument(theme);
      set({ theme });
    },

    toggleTheme: () => {
      const next = get().theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      get().setTheme(next);
    },

    hydrateFromUser: (theme) => {
      if (theme === THEMES.DARK || theme === THEMES.LIGHT) {
        get().setTheme(theme);
      }
    },
  };
});
