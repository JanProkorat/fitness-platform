import { useTranslation } from 'react-i18next';
import { Bell, LogOut, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';

export default function TopBar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder={t('shell.searchPlaceholder')}
          className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-body text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={t('notifications.title')}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4" aria-hidden="true" />
        </button>

        {user && (
          <span className="text-body text-ink-2" aria-label={t('shell.accountMenu')}>
            {user.firstName} {user.lastName}
          </span>
        )}

        <Button type="button" variant="ghost" size="sm" onClick={logout}>
          <LogOut className="size-4" aria-hidden="true" />
          {t('auth.logout')}
        </Button>
      </div>
    </header>
  );
}
