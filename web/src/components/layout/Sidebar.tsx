import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Columns,
  HelpCircle,
  MessageSquare,
  Users,
} from 'lucide-react';
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
    ],
  },
] as const;

interface Props {
  /** Fired when a nav link is activated — used to close the mobile off-canvas drawer. */
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: Props) {
  const { t } = useTranslation();
  const filterCounts = useConversationFilterCounts();
  const hasUnread = (filterCounts.data?.unreadMessages ?? 0) > 0;

  return (
    <aside className="flex h-full w-62 shrink-0 flex-col bg-sidebar">
      <nav aria-label={t('shell.navigationTitle')} className="flex h-full flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between gap-2 px-2 pb-3">
          <Wordmark size="sidebar" />
          {/* Inert — no notification surface is built in v1. Matches the
              treatment of Help & Support / Settings below: a disabled
              control with a "coming soon" title, not a live control that
              does nothing on activation. */}
          <button
            type="button"
            disabled
            title={t('shell.comingSoon')}
            aria-label={t('notifications.title')}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted disabled:cursor-not-allowed"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.headerKey} className="flex flex-col gap-1">
              <div className="flex h-3 items-center justify-between px-2">
                <span className="flex items-center gap-1.5 text-label font-semibold tracking-label text-sidebar-muted uppercase">
                  {section.dot && <span className="size-1.5 rounded-full bg-nutrition" aria-hidden="true" />}
                  {t(section.headerKey)}
                </span>
                {/* Static decorative glyph — not a collapse control. Two
                    sections of two items each is nothing to collapse, and a
                    working collapse could hide a nav item that
                    shell.smoke.spec.ts asserts is always visible. */}
                <ChevronDown className="size-3 text-sidebar-muted" aria-hidden="true" />
              </div>
              {section.items.map(({ to, labelKey, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9.5 items-center gap-2.5 rounded-field px-3 text-body transition-colors',
                      isActive
                        ? 'bg-sidebar-active font-semibold text-sidebar-text'
                        : 'font-medium text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-text',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {t(labelKey)}
                  {to === '/clients' && hasUnread && (
                    <span
                      role="img"
                      aria-label={t('clients.chips.unreadMessages')}
                      data-testid="sidebar-unread-dot"
                      className="ml-auto size-2 rounded-full bg-marker-bright"
                    />
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled
            title={t('shell.comingSoon')}
            className="flex h-9.5 items-center gap-2.5 rounded-field px-3 text-body text-sidebar-muted disabled:cursor-not-allowed"
          >
            <HelpCircle className="size-4" aria-hidden="true" />
            {t('sidebar.help')}
          </button>

          <div className="border-t border-sidebar-active px-2 pt-3 pb-2">
            <AccountMenu onNavigate={onNavigate} />
          </div>
        </div>
      </nav>
    </aside>
  );
}
