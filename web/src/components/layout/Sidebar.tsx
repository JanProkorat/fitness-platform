import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Columns,
  HelpCircle,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

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
    items: [
      { to: '/clients', labelKey: 'sidebar.clients', Icon: Users },
      { to: '/inbox', labelKey: 'sidebar.inbox', Icon: MessageSquare },
    ],
  },
  {
    headerKey: 'sidebar.nutritionSection',
    items: [
      { to: '/recipes', labelKey: 'sidebar.recipes', Icon: BookOpen },
      { to: '/ingredients', labelKey: 'sidebar.ingredients', Icon: Columns },
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

function formatRoleLabel(roles: string[], t: (key: string) => string): string {
  const held = new Set(roles.map((role) => role.toLowerCase()));
  return ROLE_ORDER.filter((role) => held.has(role))
    .map((role) => t(`roles.${role}`))
    .join(' · ');
}

interface Props {
  /** Fired when a nav link is activated — used to close the mobile off-canvas drawer. */
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const roleLabel = user ? formatRoleLabel(user.roles, t) : '';

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-5 bg-sidebar-bg px-4 py-6">
      <div className="flex items-center justify-between gap-2 px-2 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-sm bg-brand text-body font-extrabold text-paper">
            GF
          </div>
          <span className="text-body font-bold text-paper">{t('common.appName')}</span>
        </div>
        {/* Inert — no notification surface is built in v1, same as the
            pre-#1073 top bar's bell (no onClick either). */}
        <button
          type="button"
          aria-label={t('notifications.title')}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-paper"
        >
          <Bell className="size-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.headerKey} className="flex flex-col gap-1">
            <div className="flex h-3 items-center justify-between px-2">
              <span className="text-label font-semibold text-muted-foreground uppercase">
                {t(section.headerKey)}
              </span>
              {/* Static decorative glyph — not a collapse control. Two
                  sections of two items each is nothing to collapse, and a
                  working collapse could hide a nav item that
                  shell.smoke.spec.ts asserts is always visible. */}
              <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
            </div>
            {section.items.map(({ to, labelKey, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex h-8 items-center gap-2.5 rounded-sm p-2 text-body transition-colors',
                    isActive
                      ? 'bg-sidebar-accent font-semibold text-paper'
                      : 'font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-paper',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(labelKey)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          title={t('shell.comingSoon')}
          className="flex items-center gap-2.5 rounded-sm p-2 text-body text-muted-foreground disabled:cursor-not-allowed"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          {t('sidebar.help')}
        </button>
        <button
          type="button"
          disabled
          title={t('shell.comingSoon')}
          className="flex items-center gap-2.5 rounded-sm p-2 text-body text-muted-foreground disabled:cursor-not-allowed"
        >
          <Settings className="size-4" aria-hidden="true" />
          {t('sidebar.settings')}
        </button>

        {/* restoreSession() populates `user` asynchronously — guard against
            the render pass before it resolves (TopBar.tsx used the same
            guard previously). */}
        {user && (
          <div className="flex items-center justify-between gap-2 border-t border-sidebar-accent px-2 pt-3 pb-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-meta font-semibold text-paper">
                {user.firstName} {user.lastName}
              </span>
              {roleLabel && <span className="truncate text-label text-faint">{roleLabel}</span>}
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label={t('auth.logout')}
              className="flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-paper"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
