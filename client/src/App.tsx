import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from '@/app/router';
import { DialogHost } from '@/components/dialog';
import { ToastHost } from '@/features/notifications/ToastHost';
import { useAuthStore } from '@/features/auth/store';
import { IdleSessionWatcher } from '@/features/theme/IdleSessionWatcher';
import { useThemeStore } from '@/features/theme/themeStore';

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  // Ensure theme is applied before paint of routed UI.
  useThemeStore.getState();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <IdleSessionWatcher />
      <ToastHost />
      <DialogHost />
      <AppRouter />
    </BrowserRouter>
  );
}
