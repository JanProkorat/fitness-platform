import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';

import { PageHeader } from '@/components/layout';
import { Button, Tag, Dialog, Input } from '@/components/ui';
import { PropertyList, StatsGrid } from '@/components/data';
import { ActivityTimeline } from '@/components/domain';
import { QuestionnaireAnswersSection } from '@/components/questionnaire';

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);


  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const ob = client?.onboarding;

  /** Translate an enum/tag value via clients.values.X, fall back to raw value */
  const v = (val: string | null | undefined) => {
    if (!val) return '—';
    const key = `clients.values.${val}`;
    const translated = t(key);
    return translated !== key ? translated : val;
  };

  // Compliance color helper
  const complianceColor = useMemo(() => {
    const cp = client?.compliancePercent;
    if (cp == null) return 'text-text3';
    if (cp >= 80) return 'text-green';
    if (cp >= 60) return 'text-orange';
    return 'text-red';
  }, [client?.compliancePercent]);

  const complianceVariant = useMemo((): 'green' | 'orange' | 'red' | 'gray' => {
    const cp = client?.compliancePercent;
    if (cp == null) return 'gray';
    if (cp >= 80) return 'green';
    if (cp >= 60) return 'orange';
    return 'red';
  }, [client?.compliancePercent]);

  // Weight progress
  const weightProgress = useMemo(() => {
    if (!client?.weightKg || !client?.latestMeasurement?.weightKg) return null;
    const diff = client.latestMeasurement.weightKg - client.weightKg;
    return Math.round(diff * 10) / 10;
  }, [client]);

  // Goal tag variant
  const goalTagVariant = useMemo((): 'blue' | 'green' | 'orange' | 'purple' => {
    const goal = ob?.derivedNutritionGoal || ob?.primaryGoal;
    if (!goal) return 'blue';
    const lower = goal.toLowerCase();
    if (lower.includes('cut') || lower.includes('hubn')) return 'blue';
    if (lower.includes('bulk') || lower.includes('nabr')) return 'purple';
    return 'green';
  }, [ob]);

  // Calculate age from dateOfBirth
  const clientAge = useMemo(() => {
    if (!client?.dateOfBirth) return null;
    const birth = new Date(client.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [client?.dateOfBirth]);

  // Build property list items
  const propertyItems = useMemo(() => {
    if (!client) return [];
    const items: Array<{
      label: string;
      icon?: string;
      value: React.ReactNode;
      editable?: boolean;
      onEdit?: (value: string) => void;
    }> = [];

    // Vek
    if (clientAge != null) {
      items.push({
        label: 'Věk',
        icon: '📅',
        value: `${clientAge} let`,
        editable: false,
      });
    }

    // Vyska / vaha
    const height = client.heightCm;
    const weight = client.latestMeasurement?.weightKg ?? client.weightKg;
    if (height != null || weight != null) {
      const weightDiff = weightProgress;
      items.push({
        label: 'Výška / váha',
        icon: '📏',
        value: (
          <span>
            {height != null ? `${height} cm` : ''}
            {height != null && weight != null ? ' · ' : ''}
            {weight != null ? `${weight} kg` : ''}
            {weightDiff != null && weightDiff !== 0 && (
              <span className={`ml-1.5 text-xs ${weightDiff < 0 ? 'text-green' : 'text-orange'}`}>
                {weightDiff < 0 ? '↓' : '↑'} {Math.abs(weightDiff)} kg
              </span>
            )}
          </span>
        ),
      });
    }

    // Cilova vaha
    if (ob?.targetWeightKg != null) {
      items.push({
        label: 'Cílová váha',
        icon: '🎯',
        value: `${ob.targetWeightKg} kg`,
        editable: true,
      });
    }

    // Email
    if (client.email) {
      items.push({
        label: 'Email',
        icon: '✉',
        value: <span className="text-blue">{client.email}</span>,
      });
    }

    // Aktivni plany
    items.push({
      label: 'Aktivní plány',
      icon: '📋',
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-text3">{t('clients.noPlans') !== 'clients.noPlans' ? t('clients.noPlans') : 'Žádné plány'}</span>
        </span>
      ),
    });

    // Alergie
    if (ob?.allergies) {
      items.push({
        label: 'Alergie',
        icon: '⚠',
        value: ob.allergies,
        editable: true,
      });
    }

    return items;
  }, [client, clientAge, weightProgress, ob, t]);

  // Build stats
  const statsItems = useMemo(() => {
    if (!client) return [];
    return [
      {
        label: 'Compliance',
        value: client.compliancePercent != null ? `${client.compliancePercent} %` : '—',
        valueColor: complianceColor,
      },
      {
        label: 'Streak',
        value: client.currentStreak > 0 ? `${client.currentStreak} dní` : '0',
      },
      {
        label: 'Pokrok váhy',
        value: weightProgress != null && weightProgress !== 0
          ? `${weightProgress > 0 ? '+' : ''}${weightProgress} kg`
          : '—',
        valueColor: weightProgress != null && weightProgress < 0 ? 'text-green' : weightProgress != null && weightProgress > 0 ? 'text-orange' : undefined,
      },
    ];
  }, [client, complianceColor, weightProgress]);

  // Build weight progress chart data (simple bars)
  const weightChartData = useMemo(() => {
    if (!client?.weightKg) return null;
    const baseWeight = client.weightKg;
    const latestWeight = client.latestMeasurement?.weightKg ?? baseWeight;
    const targetWeight = ob?.targetWeightKg ?? latestWeight;
    const maxVal = Math.max(baseWeight, latestWeight, targetWeight) + 2;
    const minVal = Math.min(baseWeight, latestWeight, targetWeight) - 2;
    const range = maxVal - minVal || 1;

    return {
      bars: [
        { label: 'Start', value: baseWeight, pct: ((baseWeight - minVal) / range) * 100 },
        { label: 'Aktuální', value: latestWeight, pct: ((latestWeight - minVal) / range) * 100 },
        { label: 'Cíl', value: targetWeight, pct: ((targetWeight - minVal) / range) * 100 },
      ],
    };
  }, [client, ob]);

  // Build activity timeline items
  const activityItems = useMemo(() => {
    const items: Array<{ id: string; date: string; title: string; description?: string; icon?: string }> = [];

    if (client?.latestMeasurement) {
      items.push({
        id: 'measurement',
        date: new Date(client.latestMeasurement.measuredAt).toLocaleDateString('cs-CZ'),
        title: 'Tělesné míry zadány',
        icon: '📏',
        description: client.latestMeasurement.weightKg != null
          ? `Váha: ${client.latestMeasurement.weightKg} kg`
          : undefined,
      });
    }

    if (client?.linkedAt) {
      items.push({
        id: 'linked',
        date: new Date(client.linkedAt).toLocaleDateString('cs-CZ'),
        title: 'Klient propojen',
        icon: '🔗',
      });
    }

    return items;
  }, [client]);

  // Subtitle for PageHeader
  const subtitleNode = useMemo(() => {
    if (!client) return undefined;
    const goal = ob?.primaryGoal || ob?.derivedNutritionGoal || client.goals;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        {goal && <Tag variant={goalTagVariant}>{v(goal)}</Tag>}
        {client.currentStreak > 0 && (
          <Tag variant="green">{'🔥'} {client.currentStreak} dní streak</Tag>
        )}
        {client.compliancePercent != null && (
          <Tag variant={complianceVariant}>{client.compliancePercent} % compliance</Tag>
        )}
      </div>
    );
  }, [client, ob, goalTagVariant, complianceVariant]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-text3">
        {t('common.loading')}
      </div>
    );
  }

  if (!client) return null;

  // Client has not registered yet — show pending invite state
  const isPending = !client.onboarding && !client.heightCm && !client.weightKg && !client.dateOfBirth;

  if (isPending) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader icon="👤" title={clientName} subtitle={client.email ?? undefined} />
        <div style={{ padding: '40px 80px', maxWidth: 600 }}>
          <div style={{
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-br)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>✉️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Pozvánka odeslána</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{client.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              Klient zatím nemá vytvořený účet. Na jeho email byla odeslána pozvánka
              s odkazem pro registraci. Po registraci si klient vyplní své údaje
              (váha, výška, cíle, alergie) a jeho profil se zde automaticky doplní.
            </div>
          </div>

          <div style={{
            marginTop: 20,
            padding: '16px 20px',
            background: 'var(--bg2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--text3)',
          }}>
            <div style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Co se stane po registraci klienta?</div>
            <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Klient vyplní svou anamnézu a osobní údaje</li>
              <li>Budete moci nastavit jeho výživové cíle a makra</li>
              <li>Můžete mu vytvořit jídelníček a tréninkový plán</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <PageHeader
        icon="👤"
        title={clientName}
        subtitle={client.email ?? undefined}
        actions={
          <div className="flex items-center gap-1.5">
            {subtitleNode}
            <Button onClick={() => setEditDialogOpen(true)}>
              ✏ {t('clients.editProfile')}
            </Button>
            <Button variant="primary" onClick={() => navigate(`/messages?clientId=${id}`)}>
              ✉ {t('clients.sendMessage')}
            </Button>
          </div>
        }
      />

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3 max-w-[1200px]">
          {/* Property List */}
          <PropertyList items={propertyItems} />

          {/* Questionnaire Answers */}
          <div className="my-3.5">
            <QuestionnaireAnswersSection clientId={id!} />
          </div>

          {/* Divider */}
          <div className="h-px bg-border my-3.5" />

          {/* Stats Grid */}
          <StatsGrid stats={statsItems} columns={3} />

          {/* Weight Progress Chart */}
          {weightChartData && (
            <div className="mb-4">
              <div className="text-[11px] text-text3 font-medium uppercase tracking-[0.04em] mb-2">
                Váhový progres
              </div>
              <div className="flex items-end gap-3 h-[80px]">
                {weightChartData.bars.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-[11px] text-text2 font-medium">{bar.value} kg</div>
                    <div
                      className="w-full rounded-sm bg-accent-bg border border-accent-br transition-all"
                      style={{ height: `${Math.max(bar.pct, 10)}%` }}
                    />
                    <div className="text-[11px] text-text3">{bar.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border my-3.5" />

          {/* Section heading: Recent Activity */}
          <h2 className="text-[22px] font-semibold tracking-tight text-text mb-2">
            Nedávná aktivita
          </h2>

          {/* Activity Timeline */}
          {activityItems.length > 0 ? (
            <ActivityTimeline items={activityItems} />
          ) : (
            <p className="text-[13px] text-text3">Žádná nedávná aktivita</p>
          )}
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title="Upravit profil"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={() => setEditDialogOpen(false)}>
              Uložit
            </Button>
          </>
        }
      >
        <div className="space-y-0">
          <Input
            label="Jméno"
            defaultValue={client?.firstName ?? ''}
            placeholder="Jméno"
          />
          <Input
            label="Příjmení"
            defaultValue={client?.lastName ?? ''}
            placeholder="Příjmení"
          />
          <Input
            label="Email"
            defaultValue={client?.email ?? ''}
            placeholder="Email"
            type="email"
          />
          <Input
            label="Výška (cm)"
            defaultValue={client?.heightCm?.toString() ?? ''}
            placeholder="168"
            type="number"
          />
          <Input
            label="Váha (kg)"
            defaultValue={client?.weightKg?.toString() ?? ''}
            placeholder="63"
            type="number"
          />
        </div>
      </Dialog>
    </div>
  );
}
