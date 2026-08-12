/**
 * Theme + session/lockout security defaults (URD §1.3 / security chapter).
 * Optional 2FA is intentionally deferred.
 */

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type ThemePreference = (typeof THEMES)[keyof typeof THEMES];

export const ALL_THEMES: ThemePreference[] = Object.values(THEMES);

export const THEME_LABELS: Record<ThemePreference, string> = {
  [THEMES.LIGHT]: 'Light',
  [THEMES.DARK]: 'Dark',
};

export function isThemePreference(value: string): value is ThemePreference {
  return (ALL_THEMES as string[]).includes(value);
}

/** Idle minutes before forced logout (0 = disabled). */
export const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 30;

/** Failed password attempts before temporary lockout. */
export const DEFAULT_LOGIN_MAX_FAILED_ATTEMPTS = 5;

/** Minutes the account stays locked after hitting the attempt limit. */
export const DEFAULT_LOGIN_LOCKOUT_MINUTES = 15;

export interface SecurityConfigDto {
  sessionIdleTimeoutMinutes: number;
  loginMaxFailedAttempts: number;
  loginLockoutMinutes: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfigDto = {
  sessionIdleTimeoutMinutes: DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES,
  loginMaxFailedAttempts: DEFAULT_LOGIN_MAX_FAILED_ATTEMPTS,
  loginLockoutMinutes: DEFAULT_LOGIN_LOCKOUT_MINUTES,
};

/** Lightweight user-agent summary for audit metadata (not a full parser). */
export function summarizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return 'unknown';
  const ua = userAgent.trim();
  const browser =
    /Edg\//i.test(ua)
      ? 'Edge'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : 'Browser';
  const os =
    /Windows/i.test(ua)
      ? 'Windows'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iOS/i.test(ua)
          ? 'iOS'
          : /Mac OS X|Macintosh/i.test(ua)
            ? 'macOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'OS';
  return `${browser} / ${os}`;
}
