import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const stats = [
    { label: t('dashboard.activeClients'), value: '—', color: 'text-gold', note: t('dashboard.loadingNote') },
    { label: t('dashboard.avgCompliance'), value: '—', color: 'text-gold-bright', note: '—' },
    { label: t('dashboard.workoutsPerPlan'), value: '—', color: 'text-green-bright', note: t('dashboard.thisWeek') },
    { label: t('dashboard.alerts'), value: '0', color: 'text-amber', note: t('dashboard.allGood') },
  ];

  const days = [
    { key: 'mon', h: 46 },
    { key: 'tue', h: 35 },
    { key: 'wed', h: 58 },
    { key: 'thu', h: 28 },
    { key: 'fri', h: 40 },
    { key: 'sat', h: 20 },
    { key: 'sun', h: 16 },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('dashboard.title')}</h1>
          <p className="text-xs text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        {user?.roles.includes('Trainer') && (
          <a
            href="/clients"
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
          >
            {t('dashboard.newClient')}
          </a>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-sm border border-border bg-surface px-5 py-4"
            >
              <div className="lbl mb-2">{s.label}</div>
              <div className={`text-3xl font-bold leading-none ${s.color}`}>
                {s.value}
              </div>
              <div className="mt-1.5 text-[11px] text-muted">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Placeholder content */}
        <div className="grid grid-cols-[1fr_300px] gap-5">
          {/* Client overview */}
          <div className="rounded-sm border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[15px] font-semibold">
                {t('dashboard.clientOverview')}
              </span>
              <a
                href="/clients"
                className="rounded-sm border border-gold-dim px-3.5 py-1.5 font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:border-gold hover:text-gold"
              >
                {t('dashboard.showAll')}
              </a>
            </div>
            <div className="flex flex-col items-center justify-center py-16 text-text3">
              <span className="text-4xl">&#x1F465;</span>
              <p className="mt-3 text-sm">
                {t('dashboard.clientDataPlaceholder')}
              </p>
            </div>
          </div>

          {/* Activity sidebar */}
          <div className="flex flex-col gap-4">
            <div className="rounded-sm border border-border bg-surface p-5">
              <div className="mb-3 text-[13px] font-semibold">
                {t('dashboard.weeklyActivity')}
              </div>
              <div className="flex h-[72px] items-end gap-2">
                {days.map(({ key, h }) => (
                    <div
                      key={key}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t-sm bg-gradient-to-b from-gold to-gold-dim opacity-30"
                        style={{ height: `${h}px` }}
                      />
                      <span className="text-[9px] text-muted-dark">
                        {t(`dashboard.${key}`)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-sm border border-border bg-surface p-5">
              <div className="mb-3 text-[13px] font-semibold">
                {t('dashboard.quickActions')}
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href="/clients"
                  className="rounded-sm border border-border px-3 py-2 text-xs text-text2 transition-colors hover:border-gold hover:text-gold"
                >
                  &#x1F465; {t('dashboard.clientsOverviewAction')}
                </a>
                <a
                  href="/profile"
                  className="rounded-sm border border-border px-3 py-2 text-xs text-text2 transition-colors hover:border-gold hover:text-gold"
                >
                  &#x2699;&#xFE0F; {t('dashboard.profileSettingsAction')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
