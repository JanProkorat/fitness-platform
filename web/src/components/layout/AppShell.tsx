import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

/**
 * Authenticated shell: sidebar around the routed page content. There is no
 * global top bar (#1073) — the wireframe carries no cross-portal search, and
 * everything a top bar used to hold (notifications, the signed-in user,
 * logout) now lives in the sidebar's own header and footer blocks.
 *
 * Below the `lg` breakpoint the static sidebar is replaced by an off-canvas
 * drawer (built on the `Sheet` primitive) triggered from a hamburger button
 * at the top-left of `<main>`'s padding box, and the content column never
 * grows wider than the viewport — any content that would otherwise overflow
 * (a table, a wide tab list) scrolls within its own container instead of
 * the whole page sliding sideways.
 */
export default function AppShell() {
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-60 gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">{t('shell.navigationTitle')}</SheetTitle>
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={t('shell.openNavigation')}
            className="mb-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
