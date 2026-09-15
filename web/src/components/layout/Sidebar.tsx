import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Apple, BookOpen, MessageSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * v1 navigation — only the four areas this rebuild actually delivers.
 * See docs/superpowers/specs/2026-09-14-web-v1-rebuild-design.md §9: the
 * wireframe has sidebar areas (Automations, Storage, Forms, Metrics) with no
 * backend feature slice behind them yet. Do not add them here.
 */
const NAV_ITEMS = [
  { to: '/clients', labelKey: 'sidebar.clients', Icon: Users },
  { to: '/inbox', labelKey: 'sidebar.inbox', Icon: MessageSquare },
  { to: '/ingredients', labelKey: 'sidebar.ingredients', Icon: Apple },
  { to: '/recipes', labelKey: 'sidebar.recipes', Icon: BookOpen },
] as const;

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center px-4 text-title font-bold text-ink">
        {t('common.appName')}
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ to, labelKey, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-sm px-3 py-2 text-body font-medium transition-colors',
                isActive
                  ? 'bg-pill text-paper'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
