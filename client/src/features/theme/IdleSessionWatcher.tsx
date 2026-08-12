import { useEffect, useRef } from 'react';
import { fetchBusinessConfig } from '@/features/settings/api';
import { useAuthStore } from '@/features/auth/store';
import { toast } from '@/features/notifications/toastStore';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
] as const;

/**
 * Logs the user out after configured idle minutes (URD session timeout).
 * Timeout of 0 disables the watcher.
 */
export function IdleSessionWatcher() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const idleMsRef = useRef(30 * 60_000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBusinessConfig()
      .then((cfg) => {
        if (cancelled) return;
        const minutes = cfg.sessionIdleTimeoutMinutes ?? 30;
        idleMsRef.current = Math.max(0, minutes) * 60_000;
      })
      .catch(() => {
        // Keep default 30 minutes when config is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function schedule() {
      clearTimer();
      const idleMs = idleMsRef.current;
      if (idleMs <= 0) return;
      timerRef.current = setTimeout(() => {
        void (async () => {
          toast().error('Signed out due to inactivity');
          await logout();
        })();
      }, idleMs);
    }

    function onActivity() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      schedule();
    }

    schedule();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onActivity);

    return () => {
      clearTimer();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener('visibilitychange', onActivity);
    };
  }, [user, logout]);

  return null;
}
