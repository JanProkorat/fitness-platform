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
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
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

/**
 * Fixed precedence for the signed-in user's role line — never `roles[0]`,
 * the backend array order carries no contract (GET /users/me). A dual-role
 * professional legitimately holds more than one of these at once (#776);
 * every held role is shown, joined, rather than picking just one.
 */
const ROLE_ORDER = ['admin', 'trainer', 'nutritionist', 'client'] as const;

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
}

function formatRoleLabel(roles: string[], t: (key: string) => string): string {
  const held = new Set(roles.map((role) => role.toLowerCase()));
  return ROLE_ORDER.filter((role) => held.has(role))
    .map((role) => t(`roles.${role}`))
    .join(' · ');
}

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
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const roleLabel = user ? formatRoleLabel(user.roles, t) : '';
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
          {/* Rail-only log-out; the expanded one sits in the user row below. */}
          <Fold open={collapsed}>
            <button
              type="button"
              onClick={logout}
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
              className={cn(ROW, FOCUS, 'mb-1 text-marker hover:opacity-80')}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </Fold>

          {/* Inert — no notification surface is built in v1. Same treatment as
              Help & Support / Settings: a disabled control with a "coming
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
              <button
                type="button"
                disabled
                title={t('shell.comingSoon')}
                className={cn(ROW, 'text-sidebar-muted disabled:cursor-not-allowed')}
              >
                <Settings className="size-4 shrink-0" aria-hidden="true" />
                {t('sidebar.settings')}
              </button>
            </div>
          </Fold>

          {/* restoreSession() populates `user` asynchronously — guard against
              the render pass before it resolves (TopBar.tsx used the same
              guard previously). */}
          {user && (
            <div
              className={cn(
                'mt-2 flex items-center border-t border-sidebar-active pt-3 pb-2 transition-[padding]',
                MOTION,
                collapsed ? 'px-0' : 'px-2',
              )}
            >
              <NavLink
                to="/profile"
                onClick={onNavigate}
                title={t('sidebar.profileLink')}
                aria-label={collapsed ? t('sidebar.profileLink') : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-field p-1 transition-colors',
                    FOCUS,
                    isActive ? 'bg-sidebar-active' : 'hover:bg-sidebar-active/60',
                  )
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-meta font-semibold text-sidebar-text"
                >
                  {initialsOf(user.firstName, user.lastName)}
                </span>
                <span
                  aria-hidden={collapsed || undefined}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-0.5 transition-opacity',
                    MOTION,
                    collapsed && 'opacity-0',
                  )}
                >
                  <span className="truncate text-meta font-semibold text-sidebar-text">
                    {user.firstName} {user.lastName}
                  </span>
                  {roleLabel && <span className="truncate text-label text-sidebar-muted">{roleLabel}</span>}
                </span>
              </NavLink>
              <div
                inert={collapsed}
                aria-hidden={collapsed || undefined}
                className={cn(
                  'shrink-0 overflow-hidden transition-[max-width,opacity,margin]',
                  MOTION,
                  collapsed ? 'ml-0 max-w-0 opacity-0' : '-mr-1 ml-1 max-w-8 opacity-100',
                )}
              >
                <button
                  type="button"
                  onClick={logout}
                  aria-label={t('auth.logout')}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-marker transition-opacity hover:opacity-80',
                    FOCUS,
                  )}
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
