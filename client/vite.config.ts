import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ayetis/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/features/auth/store.ts',
        'src/features/auth/permissions.ts',
        'src/features/auth/pages/LoginPage.tsx',
        'src/features/users/permissionState.ts',
        'src/features/cases/components/detail/clinical/clinicalUtils.ts',
        'src/features/cases/caseDetailNav.ts',
        'src/features/cases/components/SlaProgressBar.tsx',
        'src/features/notifications/toastStore.ts',
        'src/components/dialog/dialogStore.ts',
        'src/features/theme/themeStore.ts',
        'src/features/corporate/orgContext.ts',
        'src/lib/api.ts',
      ],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
