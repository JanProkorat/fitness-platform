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
 */
export default function EntryPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/clients" replace />;
  }

  return (
    <div className="grid grid-cols-1 items-start bg-surface panel:grid-cols-[minmax(0,1fr)_var(--spacing-panel)]">
      <Medallion />

      <div className="min-w-0">
        <HeroSection />
        <CapabilitiesSection />
        <AudienceSection />
        <CtaSection />
      </div>

      <LoginPanel />
    </div>
  );
}
