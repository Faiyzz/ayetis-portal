import { THEME_LABELS, THEMES } from '@ayetis/shared';
import { persistThemePreference, useAuthStore } from '@/features/auth/store';
import { useThemeStore } from '@/features/theme/themeStore';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const token = useAuthStore((s) => s.token);
  const isDark = theme === THEMES.DARK;

  async function handleToggle() {
    const next = isDark ? THEMES.LIGHT : THEMES.DARK;
    setTheme(next);
    if (token) {
      try {
        await persistThemePreference(next);
      } catch {
        // Local theme still applied; server sync can retry next login.
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      aria-label={`Switch to ${isDark ? THEME_LABELS[THEMES.LIGHT] : THEME_LABELS[THEMES.DARK]} theme`}
      title={`${THEME_LABELS[theme]} theme`}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-xs font-semibold text-ink transition hover:bg-surface',
        className,
      ].join(' ')}
    >
      <span aria-hidden className="inline-flex">
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
          </svg>
        )}
      </span>
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
