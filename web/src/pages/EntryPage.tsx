import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import Medallion from '@/components/entry/Medallion';
import HeroSection from '@/components/entry/HeroSection';
import CapabilitiesSection from '@/components/entry/CapabilitiesSection';
import AudienceSection from '@/components/entry/AudienceSection';
import CtaSection from '@/components/entry/CtaSection';
import LoginPanel from '@/components/entry/LoginPanel';

/**
 * Public entry route ("/") — marketing page plus login panel (design spec
 * §6, prototype scratchpad/gf-entry.html). Deliberately kept OUTSIDE
 * ProtectedRoute (App.tsx) and outside AppShell: `<body>` is the scroll
 * container for the left column, matching the prototype's CSS one to one.
 * No `h-screen`/`overflow-hidden` on this component or any ancestor of the
 * login panel — that would reparent the sticky panel to an inner scroll
 * box and detach it from the fixed medallion.
 *
 * Hero, LoginPanel and the three marketing sections are direct grid
 * siblings (not a wrapped "left column" child), in DOM order Hero →
 * LoginPanel → Capabilities → Audience → Cta:
 *
 * - Below the `panel` breakpoint (phone/narrow): a single grid column, so
 *   this DOM order IS the visual order — hero, then the login panel, then
 *   the marketing sections. A returning coach on a phone should not have
 *   to scroll past the whole marketing site to sign in.
 * - At and above the `panel` breakpoint (desktop): LoginPanel gets explicit
 *   `col-start-2 row-span-full` placement (sticky, full-height, spanning
 *   every row the marketing content occupies in column 1). That removes it
 *   from column 1's auto-placement entirely, so Hero/Capabilities/Audience/
 *   Cta — none of which need any placement classes of their own — simply
 *   auto-place into column 1 in their relative DOM order. The net visual
 *   result is identical to the previous "wrap the four in one column-1
 *   child" structure; only the login panel's position in the DOM moved.
 */
export default function EntryPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/clients" replace />;
  }

  return (
    <div className="grid grid-cols-1 items-start bg-surface panel:grid-cols-[minmax(0,1fr)_var(--spacing-panel)]">
      <Medallion />
      <HeroSection />
      <LoginPanel />
      <CapabilitiesSection />
      <AudienceSection />
      <CtaSection />
    </div>
  );
}
