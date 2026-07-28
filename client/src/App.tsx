import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from '@/app/router';
import { DialogHost } from '@/components/dialog';
import { ToastHost } from '@/features/notifications/ToastHost';
import { useAuthStore } from '@/features/auth/store';

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <ToastHost />
      <DialogHost />
      <AppRouter />
    </BrowserRouter>
  );
}
