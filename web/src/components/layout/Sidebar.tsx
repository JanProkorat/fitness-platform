import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Columns,
  HelpCircle,
  MessageSquare,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import AccountMenu from '@/components/layout/AccountMenu';
import Wordmark from '@/components/brand/Wordmark';
import { useConversationFilterCounts } from '@/hooks/useInboxQueries';

/**
 * v1 navigation — only the two sections/four items this rebuild actually
 * delivers. See docs/superpowers/specs/2026-09-14-web-v1-rebuild-design.md
 * §9: the wireframe has more sidebar areas (Automations, Storage, Exercises,
 * Templates, Mealplans, Forms, Metrics) with no backend feature slice behind
 * them yet — those groups are not rendered at all (#1073 AC 2).
 */
const NAV_SECTIONS = [
  {
    headerKey: 'sidebar.clientManagementSection',
    dot: false,
    items: [
      { to: '/clients', labelKey: 'sidebar.clients', Icon: Users },
      { to: '/inbox', labelKey: 'sidebar.inbox', Icon: MessageSquare },
    ],
  },
  {
    headerKey: 'sidebar.nutritionSection',
    dot: true,
    items: [
      { to: '/recipes', labelKey: 'sidebar.recipes', Icon: BookOpen },
      { to: '/ingredients', labelKey: 'sidebar.ingredients', Icon: Columns },
      { to: '/plan-templates', labelKey: 'sidebar.planTemplates', Icon: CalendarDays },
    ],
  },
] as const;

interface Props {
  /** Fired when a nav link is activated — used to close the mobile off-canvas drawer. */
  onNavigate?: () => void;
  /** Icon-only 64px rail instead of the full 248px sidebar. */
  collapsed?: boolean;
  /** Renders the collapse/expand toggle; omitted in the mobile drawer, which has none. */
  onToggleCollapsed?: () => void;
}

/** Shared by every collapse animation so width, labels and page reflow move as one (matches the plan editor library panel). */
const MOTION = 'duration-300 ease-out motion-reduce:transition-none';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-text/60';

const ROW =
  'relative flex h-9.5 w-full items-center gap-2.5 overflow-hidden rounded-field px-3 text-body transition-colors';

/** Height-collapsing wrapper; the hidden side is removed from tab order and the accessibility tree. */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      aria-hidden={!open || undefined}
      className={cn(
        'grid transition-[grid-template-rows,opacity]',
        MOTION,
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function RowLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden={collapsed || undefined}
      className={cn('overflow-hidden whitespace-nowrap transition-opacity', MOTION, collapsed && 'opacity-0')}
    >
      {children}
    </span>
  );
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapsed }: Props) {
  const { t } = useTranslation();
  const filterCounts = useConversationFilterCounts();
  const hasUnread = (filterCounts.data?.unreadMessages ?? 0) > 0;
  const toggleLabel = t(collapsed ? 'shell.expandNavigation' : 'shell.collapseNavigation');
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden bg-sidebar transition-[width]',
        MOTION,
        collapsed ? 'w-16' : 'w-62',
      )}
    >
      <nav
        aria-label={t('shell.navigationTitle')}
        className={cn(
          'flex h-full flex-col gap-5 py-6 transition-[padding]',
          MOTION,
          collapsed ? 'px-3' : 'px-4',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between pb-3 transition-[padding]',
            MOTION,
            collapsed ? 'px-1' : 'px-2',
          )}
        >
          <div
            inert={collapsed}
            aria-hidden={collapsed || undefined}
            className={cn(
              'overflow-hidden transition-[max-width,opacity]',
              MOTION,
              collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100',
            )}
          >
            <Wordmark size="sidebar" />
          </div>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={toggleLabel}
              title={toggleLabel}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-[margin,color] hover:text-sidebar-text',
                MOTION,
                FOCUS,
                collapsed ? 'mr-0' : '-mr-1',
              )}
            >
              <ToggleIcon className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          className={cn(
            'flex flex-1 flex-col overflow-x-hidden overflow-y-auto transition-[gap]',
            MOTION,
            collapsed ? 'gap-1' : 'gap-5',
          )}
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.headerKey} className="flex flex-col">
              <Fold open={!collapsed}>
                <div className="flex h-3 items-center justify-between px-2 box-content pb-1">
                  <span className="flex items-center gap-1.5 text-label font-semibold tracking-label whitespace-nowrap text-sidebar-muted uppercase">
                    {section.dot && <span className="size-1.5 rounded-full bg-nutrition" aria-hidden="true" />}
                    {t(section.headerKey)}
                  </span>
                  {/* Static decorative glyph — not a collapse control. Two
                      sections of two items each is nothing to collapse, and a
                      working collapse could hide a nav item that
                      shell.smoke.spec.ts asserts is always visible. */}
                  <span className="-mr-1 flex w-8 justify-center">
                    <ChevronDown className="size-3 text-sidebar-muted" aria-hidden="true" />
                  </span>
                </div>
              </Fold>
              <div className="flex flex-col gap-1">
                {section.items.map(({ to, labelKey, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onNavigate}
                    title={collapsed ? t(labelKey) : undefined}
                    aria-label={collapsed ? t(labelKey) : undefined}
                    className={({ isActive }) =>
                      cn(
                        ROW,
                        FOCUS,
                        isActive
                          ? 'bg-sidebar-active font-semibold text-sidebar-text'
                          : 'font-medium text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-text',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <RowLabel collapsed={collapsed}>{t(labelKey)}</RowLabel>
                    {to === '/clients' && hasUnread && (
                      <span
                        role="img"
                        aria-label={t('clients.chips.unreadMessages')}
                        data-testid="sidebar-unread-dot"
                        className={cn(
                          'absolute size-2 rounded-full bg-marker-bright transition-[top,right]',
                          MOTION,
                          collapsed ? 'top-2 right-2' : 'top-3.75 right-4',
                        )}
                      />
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {/* Inert — no notification surface is built in v1. Same treatment as
              Help & Support: a disabled control with a "coming
              soon" title, not a live control that does nothing on activation.
              In the rail it is the bell above the avatar. */}
          <button
            type="button"
            disabled
            title={collapsed ? `${t('notifications.title')} — ${t('shell.comingSoon')}` : t('shell.comingSoon')}
            aria-label={collapsed ? t('notifications.title') : undefined}
            className={cn(ROW, 'text-sidebar-muted disabled:cursor-not-allowed')}
          >
            <Bell className="size-4 shrink-0" aria-hidden="true" />
            <RowLabel collapsed={collapsed}>{t('notifications.title')}</RowLabel>
          </button>

          <Fold open={!collapsed}>
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                disabled
                title={t('shell.comingSoon')}
                className={cn(ROW, 'text-sidebar-muted disabled:cursor-not-allowed')}
              >
                <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
                {t('sidebar.help')}
              </button>
            </div>
          </Fold>

          <div
            className={cn(
              'mt-2 border-t border-sidebar-active pt-3 pb-2 transition-[padding]',
              MOTION,
              collapsed ? 'px-0' : 'px-2',
            )}
          >
            <AccountMenu onNavigate={onNavigate} collapsed={collapsed} />
          </div>
        </div>
      </nav>
    </aside>
  );
}
