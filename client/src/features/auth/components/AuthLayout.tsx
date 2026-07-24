import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 10% -10%, rgba(103,61,230,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 0%, rgba(143,102,240,0.14), transparent 50%), linear-gradient(180deg, #ffffff 0%, #f7f8fc 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(103,61,230,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(103,61,230,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Link to="/login" className="sr-only">
            Ayetis Portal
          </Link>
          <span className="text-sm text-muted">Digital Workflow Portal</span>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <Outlet />
        </main>

        <footer className="pb-2 text-center text-xs text-muted/80">
          © {new Date().getFullYear()} Ayetis. Secure orthodontic case management.
        </footer>
      </div>
    </div>
  );
}
