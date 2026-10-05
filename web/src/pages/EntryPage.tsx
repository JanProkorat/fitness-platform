import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import HomeNav from '@/components/home/HomeNav';
import HomeHero from '@/components/home/HomeHero';
import HomeHowItWorks from '@/components/home/HomeHowItWorks';
import HomeCoaches from '@/components/home/HomeCoaches';
import HomeNutritionists from '@/components/home/HomeNutritionists';
import HomeMobileApp from '@/components/home/HomeMobileApp';
import HomeJoinBanner from '@/components/home/HomeJoinBanner';
import HomeFooter from '@/components/home/HomeFooter';
import LoginPanel from '@/components/entry/LoginPanel';

/**
 * Public entry layout route ("/", "/register", "/forgot-password"). It is a
 * pathless layout route in App.tsx: this component renders once per visit to
 * any of the three child routes, and LoginPanel's swap area (via
 * `useOutlet()`) renders whichever child route — LoginForm, RegisterForm, or
 * ForgotPasswordForm — is active. This page has no `<Outlet />` of its own.
 *
 * Deliberately kept OUTSIDE ProtectedRoute (App.tsx) and outside AppShell:
 * `<body>` is the scroll container for the landing column. No
 * `h-screen`/`overflow-hidden` on this component or any ancestor of the
 * login panel — that would reparent the sticky panel to an inner scroll box.
 *
 * Layout: the top nav spans the full width above a two-column grid. The
 * landing sections and the LoginPanel are direct grid siblings:
 *
 * - Below the `panel` breakpoint: a single column, so DOM order IS the
 *   visual order — hero, login panel, then the remaining sections. A
 *   returning coach on a phone does not scroll past the whole page to sign in.
 * - At and above `panel`: the panel takes column 2 (sticky, spanning every
 *   landing row) and the sections auto-place into column 1.
 *
 * The wrapper is an `isolate` stacking context so the hero's colour wash
 * (a negative-z layer inside HomeHero) paints above the page background and
 * below every section.
 */
export default function EntryPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/clients" replace />;
  }

  return (
    <div className="isolate bg-background">
      <HomeNav />
      <div className="grid grid-cols-1 items-start panel:grid-cols-[minmax(0,1fr)_var(--spacing-panel)]">
        <HomeHero />
        <LoginPanel />
        <HomeHowItWorks />
        <HomeCoaches />
        <HomeNutritionists />
        <HomeMobileApp />
        <HomeJoinBanner />
        <HomeFooter />
      </div>
    </div>
  );
}
