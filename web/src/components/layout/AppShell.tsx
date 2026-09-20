import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

/**
 * Authenticated shell: sidebar + top bar around the routed page content.
 *
 * Below the `lg` breakpoint the static sidebar is replaced by an off-canvas
 * drawer (built on the `Sheet` primitive) triggered from a hamburger button
 * in the top bar, and the content column never grows wider than the
 * viewport — any content that would otherwise overflow (a table, a wide
 * tab list) scrolls within its own container instead of the whole page
 * sliding sideways.
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
        <SheetContent side="left" className="w-64 gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">{t('shell.navigationTitle')}</SheetTitle>
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
