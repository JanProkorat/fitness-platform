import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import type { ClientSummary } from '@/api/client';

import { PageHeader } from '@/components/layout';
import { Toolbar } from '@/components/layout';
import { Button, Tag, ProgressBar } from '@/components/ui';
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

type ViewType = 'table' | 'list' | 'cards';

// -- helpers ----------------------------------------------------------------

function complianceVariant(c: number): 'green' | 'orange' | 'red' {
  if (c >= 80) return 'green';
  if (c >= 60) return 'orange';
  return 'red';
}

function complianceColor(c: number): string {
  if (c >= 80) return 'var(--green)';
  if (c >= 60) return 'var(--orange)';
  return 'var(--red)';
}

function initials(first?: string, last?: string): string {
  return `${(first ?? '')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase();
}

// Fake enriched data (API only returns basic fields; the rest will come later)
interface EnrichedClient extends ClientSummary {
  goal: string;
  goalTag: 'blue' | 'purple' | 'green' | 'orange' | 'gray';
  compliance: number;
  streak: number;
  kcal: number;
  kcalGoal: number;
  trains: number;
  trainsGoal: number;
  lastActivity: string;
  lastActivityColor: string;
}

function enrichClient(c: ClientSummary, idx: number): EnrichedClient {
  // Placeholder enrichment until the backend exposes these fields
  const goals: { goal: string; tag: EnrichedClient['goalTag'] }[] = [
    { goal: 'Hubnutí', tag: 'blue' },
    { goal: 'Nabírání', tag: 'purple' },
    { goal: 'Zdraví', tag: 'green' },
    { goal: 'Výkonnost', tag: 'orange' },
    { goal: 'Síla', tag: 'gray' },
  ];
  const g = goals[idx % goals.length];
  const complianceVals = [95, 87, 100, 52, 35];
  const streakVals = [21, 12, 34, 4, 2];
  const kcalVals = [1640, 2840, 1890, 3100, 2650];
  const kcalGoalVals = [1700, 2900, 1900, 3200, 2800];
  const trainsVals = [4, 3, 3, 2, 1];
  const trainsGoalVals = [4, 4, 3, 5, 4];
  const lastVals = ['dnes', 'dnes', 'dnes', '3 dny', '5 dní'];
  const lastColorVals = ['var(--green)', 'var(--green)', 'var(--green)', 'var(--text3)', 'var(--red)'];

  return {
    ...c,
    goal: g.goal,
    goalTag: g.tag,
    compliance: complianceVals[idx % complianceVals.length],
    streak: streakVals[idx % streakVals.length],
    kcal: kcalVals[idx % kcalVals.length],
    kcalGoal: kcalGoalVals[idx % kcalGoalVals.length],
    trains: trainsVals[idx % trainsVals.length],
    trainsGoal: trainsGoalVals[idx % trainsGoalVals.length],
    lastActivity: lastVals[idx % lastVals.length],
    lastActivityColor: lastColorVals[idx % lastColorVals.length],
  };
}

// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  // -- state ----------------------------------------------------------------
  const [view, setView] = useState<ViewType>('table');
  const [dialogOpen, setDialogOpen] = useState(false);

  // -- data -----------------------------------------------------------------
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 1],
    queryFn: () => apiClient.getClientsEndpoint(1, 5),
  });

  const clients: EnrichedClient[] =
    clientsData?.clients?.map((c, i) => enrichClient(c, i)) ?? [];

  const activeCount = clients.filter((c) => c.isActive).length;
  const totalCount = clientsData?.totalCount ?? 0;
  const avgCompliance =
    clients.length > 0
      ? Math.round(clients.reduce((sum, c) => sum + c.compliance, 0) / clients.length)
      : 0;
  const totalTrains = clients.reduce((sum, c) => sum + c.trains, 0);
  const totalTrainsGoal = clients.reduce((sum, c) => sum + c.trainsGoal, 0);
  const alertClients = clients.filter((c) => c.compliance < 50);

  // -- date string ----------------------------------------------------------
  const dateStr = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subtitle = `Přehled všech klientů · ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`;

  // -- stats ----------------------------------------------------------------
  const stats = [
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
    {
      label: 'Tréninky / plán',
      value: clients.length > 0 ? `${totalTrains}/${totalTrainsGoal}` : '—',
      sub: 'tento týden',
    },
    {
      label: 'Upozornění',
      value: String(alertClients.length),
      valueColor: alertClients.length > 0 ? 'var(--orange)' : undefined,
      sub: alertClients.length > 0 ? 'vyžaduje pozornost' : 'vše v pořádku',
    },
  ];

  // -- toolbar views --------------------------------------------------------
  const views = [
    { id: 'table', label: 'Tabulka', icon: '⊞' },
    { id: 'list', label: 'Seznam', icon: '☰' },
    { id: 'cards', label: 'Karty', icon: '⬜' },
  ];

  // -- table columns --------------------------------------------------------
  const columns = [
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
      label: 'Kalorie',
      render: (row: EnrichedClient) => (
        <div className="flex items-center gap-1.5">
          <ProgressBar
            value={Math.round((row.kcal / row.kcalGoal) * 100)}
            color="var(--accent)"
            className="w-[50px]"
            height={4}
          />
          <span className="text-xs text-text2">{row.kcal}</span>
        </div>
      ),
    },
    {
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
    },
    {
      key: 'activity',
      label: 'Aktivita',
      render: (row: EnrichedClient) => (
        <span className="text-xs" style={{ color: row.lastActivityColor }}>
          {row.lastActivity}
        </span>
      ),
    },
  ];

  // -- handlers -------------------------------------------------------------
  const handleRowClick = (row: EnrichedClient) => {
    navigate(`/clients/${row.publicId}`);
  };

  // -- render ---------------------------------------------------------------
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon="📊" title="Dashboard" subtitle={subtitle} />

      <Toolbar
        views={views}
        activeView={view}
        onViewChange={(id) => setView(id as ViewType)}
      >
        <Button variant="ghost" size="sm">⊞ Filtr</Button>
        <Button variant="ghost" size="sm">↕ Seřadit</Button>
        {user?.roles.includes('Trainer') && (
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            + Nový klient
          </Button>
        )}
      </Toolbar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3">
          {/* Stats */}
          <StatsGrid stats={stats} />

          {/* Callouts for low-compliance clients */}
          {alertClients.map((client) => (
            <Callout
              key={client.publicId}
              variant="warning"
              icon="⚠"
              title={`${client.firstName} ${client.lastName} — ${client.compliance < 40 ? 'nízká compliance' : 'vyžaduje pozornost'}`}
            >
              Compliance {client.compliance} %, plní {client.trains}/{client.trainsGoal} tréninků.{' '}
              <Mention onClick={() => navigate('/messages')}>
                ✉ Napsat zprávu
              </Mention>
            </Callout>
          ))}
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
                      navigate('/messages');
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
                      navigate('/messages');
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
                    <CardPropRow label="Tréninky:">
                      {client.trains}/{client.trainsGoal}
                    </CardPropRow>
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
          )}
        </div>
      </div>

      <NewClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
