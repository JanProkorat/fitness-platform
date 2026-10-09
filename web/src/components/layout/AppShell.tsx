import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
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
 *
 * The static sidebar collapses to a 64px icon rail on every page; the choice is
 * remembered per browser (`useSidebarCollapsed`). `variant="editor"` is the
 * opt-in for full-bleed workspaces (the plan template editor): `<main>` drops its padding and own scrolling so the page can
 * lay out flush against the rail. It is chosen by the layout route in App.tsx
 * (BrowserRouter has no route `handle`).
 */
interface Props {
  variant?: 'default' | 'editor';
}

export default function AppShell({ variant = 'default' }: Props) {
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);
  const editor = variant === 'editor';
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-62 gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">{t('shell.navigationTitle')}</SheetTitle>
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main
          className={cn(
            'flex-1 overflow-x-hidden bg-page-glow',
            editor ? 'flex min-h-0 flex-col overflow-y-hidden' : 'overflow-y-auto overscroll-contain p-6',
          )}
        >
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={t('shell.openNavigation')}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden',
              editor ? 'm-3 mb-0' : 'mb-4',
            )}
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
          {editor ? (
            <div className="min-h-0 flex-1">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
