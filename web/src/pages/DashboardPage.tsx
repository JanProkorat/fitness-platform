import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { getDashboardSummary } from '@/api/dashboard';
import { getIncomingRequests, acceptClientRequest, rejectClientRequest, type IncomingRequest } from '@/api/client-requests';
import { getTrainerQuestionnaires } from '@/api/questionnaires';
import { complianceColor, initials, enrichClient, type EnrichedClient } from '@/lib/dashboard-helpers';
import { showApiError } from '@/lib/api-errors';

import { PageHeader } from '@/components/layout';
import { Toolbar } from '@/components/layout';
import { Button, Tag, ProgressBar, Dialog } from '@/components/ui';
import { NewClientDialog } from '@/components/NewClientDialog';
import {
  DatabaseTable,
  ListView,
  CardGrid,
  Card,
  CardBody,
  CardPropRow,
  StatsGrid,
  Callout,
  Mention,
} from '@/components/data';
import { WeeklyCheckInCard } from '@/components/weekly-checkin/WeeklyCheckInCard';

type ViewType = 'table' | 'list' | 'cards';
type FilterKey = 'all' | 'active' | 'inactive' | 'withPlan' | 'noPlan' | 'lowCompliance';
type SortKey = 'name' | 'compliance' | 'streak' | 'lastActivity' | 'kcal' | 'trains';
type SortDir = 'asc' | 'desc';

const VIEW_IDS: { id: ViewType; tKey: string; icon: string }[] = [
  { id: 'table', tKey: 'common.viewTable', icon: '⊞' },
  { id: 'list', tKey: 'common.viewList', icon: '☰' },
  { id: 'cards', tKey: 'common.viewCards', icon: '⬜' },
];


export default function DashboardPage() {
  const { t, i18n } = useTranslation();

  // Build translated VIEWS and FILTER_OPTIONS inside the component so they react to locale changes
  const VIEWS = VIEW_IDS.map((v) => ({ id: v.id, label: t(v.tKey), icon: v.icon }));
  const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('dashboard.filterAll') },
    { key: 'active', label: t('dashboard.filterActive') },
    { key: 'inactive', label: t('dashboard.filterInactive') },
    { key: 'withPlan', label: t('dashboard.filterWithPlan') },
    { key: 'noPlan', label: t('dashboard.filterNoPlan') },
    { key: 'lowCompliance', label: t('dashboard.filterLowCompliance') },
  ];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  // -- state ----------------------------------------------------------------
  const [view, setView] = useState<ViewType>('table');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managedRequest, setManagedRequest] = useState<IncomingRequest | null>(null);
  const [statementText, setStatementText] = useState('');
  // null = trainer hasn't touched the select yet (fall back to the default
  // questionnaire below); '' = trainer explicitly chose "No questionnaire".
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);

  // -- incoming client requests ---------------------------------------------
  const { data: incomingRequests } = useQuery({
    queryKey: ['client-requests'],
    queryFn: getIncomingRequests,
    staleTime: 30_000,
  });

  // Questionnaire options for the accept-request dialog. Query (not a plain
  // promise) so a fetch failure is distinguishable from "trainer genuinely
  // has zero questionnaires" via `isError` — TanStack Query v5 dropped
  // useQuery's onError, so the error is surfaced inline below the <select>
  // instead of via a mutation-style callback (#636).
  const {
    data: questionnaires = [],
    isError: questionnairesError,
  } = useQuery({
    queryKey: ['trainer-questionnaires'],
    queryFn: getTrainerQuestionnaires,
    enabled: managedRequest !== null,
  });

  // Derived, not effect-synced (avoids a setState-in-effect cascade): the
  // trainer's default questionnaire pre-fills the select until they pick
  // something themselves.
  const defaultQuestionnaireId = useMemo(
    () => questionnaires.find((q) => q.isDefault && q.isActive)?.publicId ?? '',
    [questionnaires],
  );
  const effectiveQuestionnaireId = selectedQuestionnaireId ?? defaultQuestionnaireId;

  const openManageDialog = (req: IncomingRequest) => {
    setManagedRequest(req);
    setStatementText('');
    setSelectedQuestionnaireId(null);
  };

  const dashAcceptMutation = useMutation({
    mutationFn: ({ publicId, questionnaireId, statement }: { publicId: string; questionnaireId?: string; statement?: string }) =>
      acceptClientRequest(publicId, questionnaireId || null, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      setManagedRequest(null);
    },
    onError: (err) => {
      showApiError(err, 'clientRequests.acceptError');
    },
  });

  const dashRejectMutation = useMutation({
    mutationFn: ({ publicId, statement }: { publicId: string; statement?: string }) =>
      rejectClientRequest(publicId, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      setManagedRequest(null);
    },
    onError: (err) => {
      showApiError(err, 'clientRequests.rejectError');
    },
  });

  // -- data -----------------------------------------------------------------
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
  });

  const isTrainer = user?.roles?.includes('Trainer') ?? false;
  const isNutritionist = user?.roles?.includes('Nutritionist') ?? false;

  const clients: EnrichedClient[] =
    dashboardData?.clients?.map((c) => enrichClient(c)) ?? [];

  const activeCount = clients.filter((c) => c.isActive).length;
  const totalCount = clients.length;
  // Only count clients with an active plan relevant to the coach's role.
  const clientsWithPlans = clients.filter((c) =>
    (isNutritionist && c.activeNutritionPlansCount > 0) ||
    (isTrainer && c.hasActiveTrainingPlan),
  );
  const avgCompliance =
    clientsWithPlans.length > 0
      ? Math.round(clientsWithPlans.reduce((sum, c) => sum + c.compliance, 0) / clientsWithPlans.length)
      : 0;
  const totalTrains = clients.reduce((sum, c) => sum + c.trains, 0);
  const totalTrainsGoal = clients.reduce((sum, c) => sum + c.trainsGoal, 0);
  const activePlansCount = clients.reduce((sum, c) => sum + c.activeNutritionPlansCount, 0);
  const alertClients = clientsWithPlans.filter((c) => c.compliance < 50);

  // -- filter & sort options ------------------------------------------------
  const sortOptions = useMemo(() => {
    const opts: { key: SortKey; label: string }[] = [
      { key: 'name', label: t('dashboard.sortName') },
      { key: 'compliance', label: t('dashboard.sortCompliance') },
      { key: 'streak', label: t('dashboard.sortStreak') },
      { key: 'lastActivity', label: t('dashboard.sortLastActivity') },
    ];
    if (isNutritionist) opts.push({ key: 'kcal', label: t('dashboard.sortKcal') });
    if (isTrainer) opts.push({ key: 'trains', label: t('dashboard.sortTrains') });
    return opts;
  }, [isNutritionist, isTrainer, t]);

  // Derived list used by table/list/cards. Aggregates above (stats, callouts)
  // intentionally use the unfiltered `clients`.
  const displayedClients = useMemo(() => {
    const filtered = clients.filter((c) => {
      switch (filter) {
        case 'active': return c.isActive;
        case 'inactive': return !c.isActive;
        case 'withPlan': return c.activeNutritionPlansCount > 0 || c.hasActiveTrainingPlan;
        case 'noPlan': return c.activeNutritionPlansCount === 0 && !c.hasActiveTrainingPlan;
        case 'lowCompliance':
          return ((isNutritionist && c.activeNutritionPlansCount > 0) ||
                  (isTrainer && c.hasActiveTrainingPlan)) && c.compliance < 50;
        default: return true;
      }
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, i18n.language);
          break;
        case 'compliance': cmp = a.compliance - b.compliance; break;
        case 'streak': cmp = a.streak - b.streak; break;
        case 'lastActivity': {
          const av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          cmp = av - bv;
          break;
        }
        case 'kcal': {
          const ap = a.kcalGoal > 0 ? a.todayKcalRounded / a.kcalGoal : 0;
          const bp = b.kcalGoal > 0 ? b.todayKcalRounded / b.kcalGoal : 0;
          cmp = ap - bp;
          break;
        }
        case 'trains': {
          const ap = a.trainsGoal > 0 ? a.trains / a.trainsGoal : 0;
          const bp = b.trainsGoal > 0 ? b.trains / b.trainsGoal : 0;
          cmp = ap - bp;
          break;
        }
      }
      return cmp * dir;
    });
    return filtered;
  }, [clients, filter, sortKey, sortDir, isNutritionist, isTrainer, i18n.language]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setShowSortMenu(false);
  };

  const filterLabel = FILTER_OPTIONS.find((o) => o.key === filter)?.label ?? t('dashboard.filterAll');

  // -- date string ----------------------------------------------------------
  const dateStr = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subtitle = t('dashboard.subtitle', { date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1) });

  // -- stats ----------------------------------------------------------------
  const stats = useMemo(() => {
    const items: { label: string; value: string; valueColor?: string; sub: string }[] = [
      {
        label: t('dashboard.statActiveClients'),
        value: String(activeCount),
        sub: totalCount > 0 ? t('dashboard.statActiveClientsTotal', { count: totalCount }) : '—',
      },
      {
        label: t('dashboard.statAvgCompliance'),
        value: clients.length > 0 ? `${avgCompliance} %` : '—',
        valueColor: clients.length > 0 ? complianceColor(avgCompliance) : undefined,
        sub: clients.length > 0 ? t('dashboard.statComplianceVsLastWeek') : '—',
      },
    ];

    // Role-based training / plan card
    if (isTrainer && isNutritionist) {
      items.push({
        label: t('dashboard.statTrainingsAndPlans'),
        value: clients.length > 0
          ? `${totalTrains}/${totalTrainsGoal} · ${activePlansCount}`
          : '—',
        sub: t('dashboard.statTrainingsAndPlansSub'),
      });
    } else if (isTrainer) {
      items.push({
        label: t('dashboard.statTrainingsToday'),
        value: clients.length > 0 ? `${totalTrains}/${totalTrainsGoal}` : '—',
        sub: t('dashboard.statTrainingsTodayDone'),
      });
    } else if (isNutritionist) {
      items.push({
        label: t('dashboard.statActivePlans'),
        value: clients.length > 0 ? String(activePlansCount) : '—',
        sub: activePlansCount === 1 ? t('dashboard.statActivePlan') : t('dashboard.statActivePlanPlural'),
      });
    }

    items.push({
      label: t('dashboard.statLowCompliance'),
      value: String(alertClients.length),
      valueColor: alertClients.length > 0 ? 'var(--orange)' : undefined,
      sub: alertClients.length > 0
        ? t('dashboard.statLowComplianceSub', { count: alertClients.length })
        : t('dashboard.statAllGood'),
    });

    return items;
  }, [activeCount, totalCount, clients.length, avgCompliance, totalTrains, totalTrainsGoal, activePlansCount, alertClients.length, isTrainer, isNutritionist, t]);

  // -- table columns --------------------------------------------------------
  const columns = useMemo(() => {
    const cols: { key: string; label: string; render: (row: EnrichedClient) => React.ReactNode }[] = [
      {
        key: 'name',
        label: t('dashboard.colName'),
        render: (row: EnrichedClient) => (
          <span>{row.firstName} {row.lastName}</span>
        ),
      },
      {
        key: 'goal',
        label: t('dashboard.colGoal'),
        render: (row: EnrichedClient) => (
          <Tag variant={row.goalTag}>{row.goal}</Tag>
        ),
      },
      {
        key: 'compliance',
        label: t('dashboard.colCompliance'),
        render: (row: EnrichedClient) => (
          <div className="flex items-center gap-2">
            <ProgressBar
              value={row.compliance}
              color={complianceColor(row.compliance)}
              className="w-[60px]"
              height={5}
            />
            <span className="text-xs text-text2">{row.compliance} %</span>
          </div>
        ),
      },
      {
        key: 'streak',
        label: t('dashboard.colStreak'),
        render: (row: EnrichedClient) => (
          <span className="text-[13px]">🔥 {row.streak}d</span>
        ),
      },
    ];

    if (isNutritionist) {
      cols.push({
        key: 'kcal',
        label: t('dashboard.colKcalToday'),
        render: (row: EnrichedClient) => {
          const pct = row.kcalGoal > 0 ? Math.round((row.todayKcalRounded / row.kcalGoal) * 100) : 0;
          return (
            <div className="flex items-center gap-1.5">
              <ProgressBar
                value={Math.min(pct, 100)}
                color="var(--accent)"
                className="w-[50px]"
                height={4}
              />
              <span className="text-xs text-text2">
                {row.todayKcalRounded}/{row.kcalGoal}
              </span>
            </div>
          );
        },
      });
    }

    if (isTrainer) {
      cols.push({
        key: 'trains',
        label: t('dashboard.colTrainsToday'),
        render: (row: EnrichedClient) => {
          const variant = row.trains >= row.trainsGoal
            ? 'green'
            : row.trains >= row.trainsGoal / 2
            ? 'orange'
            : 'red';
          return (
            <Tag variant={variant as 'green' | 'orange' | 'red'}>
              {row.trains}/{row.trainsGoal}
            </Tag>
          );
        },
      });
    }

    if (isNutritionist) {
      cols.push({
        key: 'nutritionPlan',
        label: t('dashboard.colNutritionPlan'),
        render: (row: EnrichedClient) => (
          <Tag variant={row.activeNutritionPlansCount > 0 ? 'green' : 'gray'}>
            {row.activeNutritionPlansCount > 0 ? t('dashboard.yesLabel') : t('dashboard.noLabel')}
          </Tag>
        ),
      });
    }

    if (isTrainer) {
      cols.push({
        key: 'trainingPlan',
        label: t('dashboard.colTrainingPlan'),
        render: (row: EnrichedClient) => (
          <Tag variant={row.hasActiveTrainingPlan ? 'green' : 'gray'}>
            {row.hasActiveTrainingPlan ? t('dashboard.yesLabel') : t('dashboard.noLabel')}
          </Tag>
        ),
      });
    }

    cols.push({
      key: 'activity',
      label: t('dashboard.colActivity'),
      render: (row: EnrichedClient) => (
        <span className="text-xs" style={{ color: row.lastActivityColor }}>
          {row.lastActivity}
        </span>
      ),
    });

    return cols;
  }, [isTrainer, isNutritionist, t]);

  // -- handlers -------------------------------------------------------------
  const handleRowClick = (row: EnrichedClient) => {
    navigate(`/clients/${row.publicId}`);
  };

  // -- render ---------------------------------------------------------------
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon="📊" title={t('dashboard.title')} subtitle={subtitle} />

      <Toolbar
        views={VIEWS}
        activeView={view}
        onViewChange={(id) => setView(id as ViewType)}
      >
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => { setShowFilterMenu((v) => !v); setShowSortMenu(false); }}>
            ⊞ {t('dashboard.filterButton')}{filter !== 'all' ? ` · ${filterLabel}` : ''}
          </Button>
          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-bg2 border border-border rounded-md shadow-lg py-1 min-w-[200px]">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setFilter(opt.key); setShowFilterMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors flex items-center justify-between"
                    style={{ color: filter === opt.key ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {opt.label}
                    {filter === opt.key && <span className="text-[10px] ml-2">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => { setShowSortMenu((v) => !v); setShowFilterMenu(false); }}>
            ↕ {t('dashboard.sortButton')}
          </Button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-bg2 border border-border rounded-md shadow-lg py-1 min-w-[180px]">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSort(opt.key)}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors flex items-center justify-between"
                    style={{ color: sortKey === opt.key ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {opt.label}
                    {sortKey === opt.key && (
                      <span className="text-[10px] ml-2">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Toolbar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3">
          {/* Incoming client requests */}
          {incomingRequests && incomingRequests.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                {t('clientRequests.title')} ({incomingRequests.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {incomingRequests.map((req) => (
                  <div
                    key={req.publicId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'var(--accent-bg)',
                      border: '1px solid var(--accent-br)',
                      borderLeft: '3px solid var(--accent)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.opacity = '1'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent-br)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                      {(req.clientFirstName[0] ?? '').toUpperCase()}{(req.clientLastName[0] ?? '').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {req.clientFirstName} {req.clientLastName}
                      </div>
                      {req.message && (
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.message}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(req.sentAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openManageDialog(req)}
                      >
                        {t('clientRequests.manage')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <StatsGrid stats={stats} />

          {/* Weekly check-ins card */}
          <div className="mt-4">
            <WeeklyCheckInCard />
          </div>

          {/* Callouts for low-compliance clients */}
          {alertClients.map((client) => {
            const details: string[] = [];
            if (isNutritionist) {
              details.push(t('dashboard.calloutComplianceDetail', { compliance: client.compliance }));
            }
            if (isTrainer) {
              details.push(t('dashboard.calloutTrainsDetail', { trains: client.trains, trainsGoal: client.trainsGoal }));
            }
            return (
              <Callout
                key={client.publicId}
                variant="warning"
                icon="⚠"
                title={`${client.firstName} ${client.lastName} — ${client.compliance < 40 ? t('dashboard.calloutTitleLow') : t('dashboard.calloutTitleAttention')}`}
                action={
                  <Mention onClick={() => navigate(`/messages?clientId=${client.publicId}`)}>
                    ✉ {t('clients.sendMessage')}
                  </Mention>
                }
              >
                {details.join(' · ')}
              </Callout>
            );
          })}
          {alertClients.length > 0 && <div className="mb-4" />}

          {/* Empty state */}
          {clients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-text3">
              <span className="text-4xl">👥</span>
              <p className="mt-3 text-sm">{t('dashboard.clientDataPlaceholder')}</p>
            </div>
          )}

          {/* Empty filtered state */}
          {clients.length > 0 && displayedClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-text3">
              <span className="text-4xl">🔍</span>
              <p className="mt-3 text-sm">{t('dashboard.noClientsForFilter')}</p>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="mt-2 text-[13px] underline hover:text-text2"
              >
                {t('dashboard.clearFilter')}
              </button>
            </div>
          )}

          {/* Table view */}
          {displayedClients.length > 0 && view === 'table' && (
            <DatabaseTable
              columns={columns}
              rows={displayedClients}
              rowKey={(row) => row.publicId ?? row.email ?? ''}
              onRowClick={handleRowClick}
              onAddRow={() => setDialogOpen(true)}
              addRowLabel={`+ ${t('dashboard.addClient')}`}
              renderRowActions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/clients/${row.publicId}`);
                    }}
                  >
                    {t('dashboard.openClient')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?clientId=${row.publicId}`);
                    }}
                  >
                    {t('dashboard.sendMessageShort')}
                  </Button>
                </>
              )}
            />
          )}

          {/* List view */}
          {displayedClients.length > 0 && view === 'list' && (
            <ListView
              items={displayedClients}
              itemKey={(item) => item.publicId ?? item.email ?? ''}
              onItemClick={handleRowClick}
              renderAvatar={(item) =>
                item.avatarBlobUrl ? (
                  <img
                    src={item.avatarBlobUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-bg border border-accent-br text-[11px] font-bold text-accent">
                    {initials(item.firstName, item.lastName)}
                  </div>
                )
              }
              renderInfo={(item) => (
                <div>
                  <div className="text-[13px] font-medium text-text truncate">
                    {item.firstName} {item.lastName}
                  </div>
                  <div className="mt-0.5">
                    <Tag variant={item.goalTag} className="text-[11px] !py-[1px] !px-1.5">
                      {item.goal}
                    </Tag>
                  </div>
                </div>
              )}
              renderRight={(item) => (
                <>
                  <div className="text-right">
                    <div
                      className="text-xs font-semibold"
                      style={{ color: complianceColor(item.compliance) }}
                    >
                      {item.compliance} %
                    </div>
                    <div className="text-[11px] text-text3">{t('dashboard.colCompliance').toLowerCase()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text2">🔥 {item.streak}d</div>
                  </div>
                </>
              )}
              renderActions={(item) => (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/clients/${item.publicId}`);
                    }}
                  >
                    {t('dashboard.openClient')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?clientId=${item.publicId}`);
                    }}
                  >
                    {t('dashboard.sendMessageShort')}
                  </Button>
                </div>
              )}
            />
          )}

          {/* Cards view */}
          {displayedClients.length > 0 && view === 'cards' && (
            <CardGrid>
              {displayedClients.map((client) => (
                <Card
                  key={client.publicId ?? client.email}
                  onClick={() => handleRowClick(client)}
                >
                  {/* Taller image area with name + goal overlay */}
                  <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
                    {client.avatarBlobUrl ? (
                      <img
                        src={client.avatarBlobUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-accent-bg border border-accent-br text-2xl font-bold text-accent">
                          {initials(client.firstName, client.lastName)}
                        </div>
                      </div>
                    )}
                    {/* Goal chip — top-right corner */}
                    {client.goal && (
                      <div className="absolute top-2 right-2 inline-flex items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
                        <Tag variant={client.goalTag} className="text-[10px] !py-[1px] !px-1.5">
                          {client.goal}
                        </Tag>
                      </div>
                    )}
                    {/* Gradient + name overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
                      <div className="truncate text-[13px] font-bold text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                        {client.firstName} {client.lastName}
                      </div>
                    </div>
                  </div>
                  <CardBody>
                    <CardPropRow label="">
                      <span
                        className="font-semibold"
                        style={{ color: complianceColor(client.compliance) }}
                      >
                        {client.compliance} %
                      </span>
                      <span className="text-text3 ml-1">compliance · 🔥{client.streak}d</span>
                    </CardPropRow>
                    {isNutritionist && (
                      <CardPropRow label={`${t('dashboard.colKcalToday')}:`}>
                        {client.todayKcalRounded}/{client.kcalGoal}
                      </CardPropRow>
                    )}
                    {isTrainer && (
                      <CardPropRow label={`${t('dashboard.colTrainsToday')}:`}>
                        {client.trains}/{client.trainsGoal}
                      </CardPropRow>
                    )}
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
          )}
        </div>
      </div>

      <NewClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      {managedRequest && (
        <Dialog
          open={true}
          onClose={() => setManagedRequest(null)}
          title={t('clientRequests.title')}
          maxWidth={420}
          footer={
            <>
              <Button
                variant="danger"
                onClick={() => dashRejectMutation.mutate({ publicId: managedRequest.publicId, statement: statementText || undefined })}
                disabled={dashRejectMutation.isPending}
              >
                {dashRejectMutation.isPending ? t('common.loading') : t('clientRequests.reject')}
              </Button>
              <Button
                variant="primary"
                onClick={() => dashAcceptMutation.mutate({
                  publicId: managedRequest.publicId,
                  questionnaireId: effectiveQuestionnaireId || undefined,
                  statement: statementText || undefined,
                })}
                disabled={dashAcceptMutation.isPending}
              >
                {dashAcceptMutation.isPending ? t('common.saving') : t('clientRequests.accept')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('common.name')}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{managedRequest.clientFirstName} {managedRequest.clientLastName}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('common.email')}</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{managedRequest.clientEmail}</div>
            </div>
            {managedRequest.message && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('clientRequests.message')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{managedRequest.message}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('clientRequests.sentAt')}</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                {new Date(managedRequest.sentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('clientRequests.selectQuestionnaire')}</div>
              <select
                value={effectiveQuestionnaireId}
                onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text)', outline: 'none',
                }}
              >
                <option value="">{t('clientRequests.noQuestionnaire')}</option>
                {questionnaires.filter((q) => q.isActive).map((q) => (
                  <option key={q.publicId} value={q.publicId}>
                    {q.title}{q.isDefault ? ` (${t('questionnaire.default')})` : ''}
                  </option>
                ))}
              </select>
              {questionnairesError && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {t('clientRequests.questionnairesLoadError')}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>{t('clientRequests.statement')}</div>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                placeholder={t('clientRequests.statementPlaceholder')}
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text)', resize: 'vertical', outline: 'none',
                }}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
