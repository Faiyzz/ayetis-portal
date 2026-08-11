import { Link, Outlet, useLocation } from 'react-router-dom';
import toothBackground from '@/assets/tooth-login-background.jpg';
import { BrandMark } from '@/features/auth/components/AuthUI';
import { useBranding } from '@/features/settings/useBranding';

export function AuthLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';
  const branding = useBranding();
  const companyName = branding?.companyName || 'Ayetis Portal';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      {isLogin ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-right bg-no-repeat"
            style={{ backgroundImage: `url(${toothBackground})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(244,247,249,0.99)_0%,rgba(244,247,249,0.96)_38%,rgba(244,247,249,0.66)_56%,rgba(244,247,249,0.05)_78%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),transparent_18%,transparent_82%,rgba(15,23,42,0.12))]" />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 10% -10%, rgba(51,65,85,0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 0%, rgba(100,116,139,0.12), transparent 50%), linear-gradient(180deg, #ffffff 0%, #f4f7f9 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
            }}
          />
        </>
      )}

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link to="/login" className="inline-flex items-center">
            <BrandMark
              tone={isLogin ? 'brand' : 'dark'}
              companyName={companyName.replace(/\s*Portal$/i, '') || 'Ayetis'}
              logoUrl={branding?.loginLogoUrl || branding?.headerLogoUrl}
            />
            <span className="sr-only">{companyName}</span>
          </Link>
          <span className={isLogin ? 'text-sm font-medium text-slate-600' : 'text-sm text-muted'}>
            Digital Workflow Portal
          </span>
        </header>

        <main
          className={[
            'flex flex-1 items-center py-10',
            isLogin ? 'justify-start' : 'justify-center',
          ].join(' ')}
        >
          <Outlet />
        </main>

        <footer
          className={[
            'pb-2 text-xs',
            isLogin ? 'text-left text-slate-600' : 'text-center text-muted/80',
          ].join(' ')}
        >
          © {new Date().getFullYear()} {companyName.replace(/\s*Portal$/i, '') || 'Ayetis'}. Secure
          orthodontic case management.
        </footer>
      </div>
    </div>
  );
}
