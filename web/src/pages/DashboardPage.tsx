import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { getDashboardSummary } from '@/api/dashboard';
import { getIncomingRequests, acceptClientRequest, rejectClientRequest, type IncomingRequest } from '@/api/client-requests';
import { getTrainerQuestionnaires, type QuestionnaireSummaryDto } from '@/api/questionnaires';
import { complianceColor, initials, enrichClient, type EnrichedClient } from '@/lib/dashboard-helpers';

import { PageHeader } from '@/components/layout';
import { Toolbar } from '@/components/layout';
import { Button, Tag, ProgressBar, Dialog } from '@/components/ui';
import { NewClientDialog } from '@/components/NewClientDialog';
import {
  DatabaseTable,
  ListView,
  CardGrid,
  Card,
  CardCover,
  CardBody,
  CardPropRow,
  StatsGrid,
  Callout,
  Mention,
} from '@/components/data';
import { WeeklyCheckInCard } from '@/components/weekly-checkin/WeeklyCheckInCard';

type ViewType = 'table' | 'list' | 'cards';

const VIEWS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'table', label: 'Tabulka', icon: '⊞' },
  { id: 'list', label: 'Seznam', icon: '☰' },
  { id: 'cards', label: 'Karty', icon: '⬜' },
];

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  // -- state ----------------------------------------------------------------
  const [view, setView] = useState<ViewType>('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managedRequest, setManagedRequest] = useState<IncomingRequest | null>(null);
  const [statementText, setStatementText] = useState('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');

  // -- incoming client requests ---------------------------------------------
  const { data: incomingRequests } = useQuery({
    queryKey: ['client-requests'],
    queryFn: getIncomingRequests,
    staleTime: 30_000,
  });

  const openManageDialog = (req: IncomingRequest) => {
    setManagedRequest(req);
    setStatementText('');
    setSelectedQuestionnaireId('');
    getTrainerQuestionnaires().then((data) => {
      setQuestionnaires(data);
      const defaultQ = data.find((q) => q.isDefault && q.isActive);
      setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
    }).catch(() => setQuestionnaires([]));
  };

  const dashAcceptMutation = useMutation({
    mutationFn: ({ publicId, questionnaireId, statement }: { publicId: string; questionnaireId?: string; statement?: string }) =>
      acceptClientRequest(publicId, questionnaireId || null, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      setManagedRequest(null);
    },
  });

  const dashRejectMutation = useMutation({
    mutationFn: ({ publicId, statement }: { publicId: string; statement?: string }) =>
      rejectClientRequest(publicId, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      setManagedRequest(null);
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

  // -- date string ----------------------------------------------------------
  const dateStr = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subtitle = `Přehled všech klientů · ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`;

  // -- stats ----------------------------------------------------------------
  const stats = useMemo(() => {
    const items: { label: string; value: string; valueColor?: string; sub: string }[] = [
      {
        label: 'Aktivní klienti',
        value: String(activeCount),
        sub: totalCount > 0 ? `celkem ${totalCount}` : '—',
      },
      {
        label: 'Avg. compliance',
        value: clients.length > 0 ? `${avgCompliance} %` : '—',
        valueColor: clients.length > 0 ? complianceColor(avgCompliance) : undefined,
        sub: clients.length > 0 ? '↑ vs. minulý týden' : '—',
      },
    ];

    // Role-based training / plan card
    if (isTrainer && isNutritionist) {
      items.push({
        label: 'Tréninky / plány',
        value: clients.length > 0
          ? `${totalTrains}/${totalTrainsGoal} · ${activePlansCount}`
          : '—',
        sub: 'tréninky tento týden · aktivní plány',
      });
    } else if (isTrainer) {
      items.push({
        label: 'Tréninky',
        value: clients.length > 0 ? `${totalTrains}/${totalTrainsGoal}` : '—',
        sub: 'splněno tento týden',
      });
    } else if (isNutritionist) {
      items.push({
        label: 'Aktivní plány',
        value: clients.length > 0 ? String(activePlansCount) : '—',
        sub: activePlansCount === 1 ? 'aktivní plán' : 'aktivních plánů',
      });
    }

    items.push({
      label: 'Nízká compliance',
      value: String(alertClients.length),
      valueColor: alertClients.length > 0 ? 'var(--orange)' : undefined,
      sub: alertClients.length > 0 ? `${alertClients.length === 1 ? 'klient' : 'klienti'} pod 50 %` : 'vše v pořádku',
    });

    return items;
  }, [activeCount, totalCount, clients.length, avgCompliance, totalTrains, totalTrainsGoal, activePlansCount, alertClients.length, isTrainer, isNutritionist]);

  // -- table columns --------------------------------------------------------
  const columns = useMemo(() => {
    const cols: { key: string; label: string; render: (row: EnrichedClient) => React.ReactNode }[] = [
      {
        key: 'name',
        label: 'Jméno',
        render: (row: EnrichedClient) => (
          <span>{row.firstName} {row.lastName}</span>
        ),
      },
      {
        key: 'goal',
        label: 'Cíl',
        render: (row: EnrichedClient) => (
          <Tag variant={row.goalTag}>{row.goal}</Tag>
        ),
      },
      {
        key: 'compliance',
        label: 'Compliance',
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
        label: 'Streak',
        render: (row: EnrichedClient) => (
          <span className="text-[13px]">🔥 {row.streak}d</span>
        ),
      },
      {
        key: 'kcal',
        label: 'Kalorie dnes',
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
      },
    ];

    if (isTrainer) {
      cols.push({
        key: 'trains',
        label: 'Tréninky',
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
        label: 'Nutriční plán',
        render: (row: EnrichedClient) => (
          <Tag variant={row.activeNutritionPlansCount > 0 ? 'green' : 'gray'}>
            {row.activeNutritionPlansCount > 0 ? 'Ano' : 'Ne'}
          </Tag>
        ),
      });
    }

    if (isTrainer) {
      cols.push({
        key: 'trainingPlan',
        label: 'Tréninkový plán',
        render: (row: EnrichedClient) => (
          <Tag variant={row.hasActiveTrainingPlan ? 'green' : 'gray'}>
            {row.hasActiveTrainingPlan ? 'Ano' : 'Ne'}
          </Tag>
        ),
      });
    }

    cols.push({
      key: 'activity',
      label: 'Aktivita',
      render: (row: EnrichedClient) => (
        <span className="text-xs" style={{ color: row.lastActivityColor }}>
          {row.lastActivity}
        </span>
      ),
    });

    return cols;
  }, [isTrainer, isNutritionist]);

  // -- handlers -------------------------------------------------------------
  const handleRowClick = (row: EnrichedClient) => {
    navigate(`/clients/${row.publicId}`);
  };

  // -- render ---------------------------------------------------------------
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon="📊" title="Dashboard" subtitle={subtitle} />

      <Toolbar
        views={VIEWS}
        activeView={view}
        onViewChange={(id) => setView(id as ViewType)}
      >
        <Button variant="ghost" size="sm">⊞ Filtr</Button>
        <Button variant="ghost" size="sm">↕ Seřadit</Button>
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
              details.push(`Compliance ${client.compliance} % — neplní plán`);
            }
            if (isTrainer) {
              details.push(`Plní ${client.trains}/${client.trainsGoal} tréninků`);
            }
            return (
              <Callout
                key={client.publicId}
                variant="warning"
                icon="⚠"
                title={`${client.firstName} ${client.lastName} — ${client.compliance < 40 ? 'nízká compliance' : 'vyžaduje pozornost'}`}
                action={
                  <Mention onClick={() => navigate(`/messages?clientId=${client.publicId}`)}>
                    ✉ Napsat zprávu
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

          {/* Table view */}
          {clients.length > 0 && view === 'table' && (
            <DatabaseTable
              columns={columns}
              rows={clients}
              rowKey={(row) => row.publicId ?? row.email ?? ''}
              onRowClick={handleRowClick}
              onAddRow={() => setDialogOpen(true)}
              addRowLabel="+ Přidat klienta"
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
                    Otevřít
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?clientId=${row.publicId}`);
                    }}
                  >
                    Zpráva
                  </Button>
                </>
              )}
            />
          )}

          {/* List view */}
          {clients.length > 0 && view === 'list' && (
            <ListView
              items={clients}
              itemKey={(item) => item.publicId ?? item.email ?? ''}
              onItemClick={handleRowClick}
              renderAvatar={(item) => (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-bg border border-accent-br text-[11px] font-bold text-accent">
                  {initials(item.firstName, item.lastName)}
                </div>
              )}
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
                    <div className="text-[11px] text-text3">compliance</div>
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
                    Otevřít
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?clientId=${item.publicId}`);
                    }}
                  >
                    Zpráva
                  </Button>
                </div>
              )}
            />
          )}

          {/* Cards view */}
          {clients.length > 0 && view === 'cards' && (
            <CardGrid>
              {clients.map((client) => (
                <Card
                  key={client.publicId ?? client.email}
                  onClick={() => handleRowClick(client)}
                >
                  <CardCover>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-accent-bg border border-accent-br text-base font-bold text-accent">
                        {initials(client.firstName, client.lastName)}
                      </div>
                    </div>
                  </CardCover>
                  <CardBody>
                    <div className="text-[13px] font-semibold text-text mb-1">
                      {client.firstName} {client.lastName}
                    </div>
                    <div className="mb-1">
                      <Tag variant={client.goalTag} className="text-[11px]">
                        {client.goal}
                      </Tag>
                    </div>
                    <CardPropRow label="">
                      <span
                        className="font-semibold"
                        style={{ color: complianceColor(client.compliance) }}
                      >
                        {client.compliance} %
                      </span>
                      <span className="text-text3 ml-1">compliance · 🔥{client.streak}d</span>
                    </CardPropRow>
                    <CardPropRow label="Kalorie:">
                      {client.todayKcalRounded}/{client.kcalGoal}
                    </CardPropRow>
                    {isTrainer && (
                      <CardPropRow label="Tréninky:">
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
                  questionnaireId: selectedQuestionnaireId || undefined,
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
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>Email</div>
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
                value={selectedQuestionnaireId}
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
