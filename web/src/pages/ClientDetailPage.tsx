import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';
import { getClientTimeline } from '@/api/timeline';
import { formatWeight } from '@/lib/personalRecordFormatters';

import { PageHeader } from '@/components/layout';
import { Button, Tag, Dialog, Input } from '@/components/ui';
import { PropertyList, StatsGrid } from '@/components/data';
import { ActivityTimeline } from '@/components/domain';
import { QuestionnaireAnswersSection } from '@/components/questionnaire';
import { WeeklyCheckInSection } from '@/components/weekly-checkin/WeeklyCheckInSection';

export default function ClientDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);


  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ['client-timeline', id],
    queryFn: () => getClientTimeline(id!, 30),
    enabled: !!id,
  });

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const ob = client?.onboarding;

  /** Translate an enum/tag value via clients.values.X, fall back to raw value */
  const v = useCallback((val: string | null | undefined) => {
    if (!val) return '—';
    const key = `clients.values.${val}`;
    const translated = t(key);
    return translated !== key ? translated : val;
  }, [t]);

  // Compliance color helper
  const complianceColor = useMemo(() => {
    const cp = client?.compliancePercent;
    if (cp == null) return 'text-text3';
    if (cp >= 80) return 'text-green';
    if (cp >= 60) return 'text-orange';
    return 'text-red';
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
  }, [client]);

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
      let allergiesDisplay = ob.allergies;
      try {
        const arr = JSON.parse(ob.allergies);
        if (Array.isArray(arr)) allergiesDisplay = arr.join(', ');
      } catch { /* use as-is */ }
      items.push({
        label: 'Alergie',
        icon: '⚠',
        value: allergiesDisplay,
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
        label: '🔥 Série',
        value: client.currentStreak,
        sub: 'dní v řadě',
        valueColor: client.currentStreak > 0 ? 'text-orange' : undefined,
      },
      {
        label: 'Compliance',
        value: client.compliancePercent != null ? `${client.compliancePercent} %` : '—',
        sub: 'za posledních 7 dní',
        valueColor: complianceColor,
      },
      {
        label: 'Pokrok váhy',
        value: weightProgress != null && weightProgress !== 0
          ? `${weightProgress > 0 ? '+' : ''}${weightProgress} kg`
          : '—',
        sub: weightProgress != null && weightProgress !== 0
          ? (weightProgress < 0 ? 'úbytek' : 'přírůstek')
          : 'beze změny',
        valueColor: weightProgress != null && weightProgress < 0 ? 'text-green' : weightProgress != null && weightProgress > 0 ? 'text-orange' : undefined,
      },
    ];
  }, [client, complianceColor, weightProgress]);

  // Build weight progress chart data (bar chart)
  const weightChartData = useMemo(() => {
    if (!client?.weightKg) return null;
    const startWeight = client.weightKg;
    const currentWeight = client.latestMeasurement?.weightKg ?? startWeight;
    const targetWeight = ob?.targetWeightKg ?? currentWeight;

    const values = [startWeight, currentWeight, targetWeight];
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    // Use 0 as the floor so bars reflect absolute scale, not just relative diff
    const floor = Math.max(0, minVal - (maxVal - minVal) * 0.5);
    const range = maxVal - floor || 1;

    return [
      { label: 'Start', value: startWeight, pct: ((startWeight - floor) / range) * 100 },
      { label: 'Aktuální', value: currentWeight, pct: ((currentWeight - floor) / range) * 100, highlight: true },
      { label: 'Cíl', value: targetWeight, pct: ((targetWeight - floor) / range) * 100 },
    ];
  }, [client, ob]);

  // Narrow the active locale to the set supported by formatWeight.
  const activeLocale = useMemo((): 'cs' | 'en' | 'de' => {
    const lang = i18n.language;
    if (lang === 'en' || lang === 'de') return lang;
    return 'cs';
  }, [i18n.language]);

  // Activity timeline — composed server-side, newest first.
  const activityItems = useMemo(() => {
    if (!timeline?.items) return [];
    return timeline.items.map((it) => {
      // Personal-record items: compose i18n title from structured payload when
      // available, otherwise fall back to the server-rendered title/description.
      if (it.type === 'personal_record' && it.personalRecord) {
        const pr = it.personalRecord;
        return {
          id: it.id,
          date: new Date(it.occurredAt).toLocaleDateString('cs-CZ'),
          icon: it.icon ?? '🏆',
          title: t('clients.personalRecord.title', {
            exerciseName: pr.exerciseName,
            weight: formatWeight(pr.weightKg, activeLocale),
          }),
          description: t('clients.personalRecord.description', {
            reps: pr.reps,
          }),
        };
      }

      return {
        id: it.id,
        date: new Date(it.occurredAt).toLocaleDateString('cs-CZ'),
        title: it.title,
        description: it.description ?? undefined,
        icon: it.icon ?? undefined,
      };
    });
  }, [timeline, t, activeLocale]);

  // Subtitle for PageHeader
  const subtitleNode = useMemo(() => {
    if (!client) return undefined;
    const goal = ob?.primaryGoal || ob?.derivedNutritionGoal || client.goals;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        {goal && <Tag variant={goalTagVariant}>{v(goal)}</Tag>}
      </div>
    );
  }, [client, ob, goalTagVariant, v]);

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
  const isPending = client.hasRegistered === false;

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
        <div className="px-20 py-3">
          {/* Property List */}
          <PropertyList items={propertyItems} />

          {/* Questionnaire Answers */}
          <div className="my-3.5">
            <QuestionnaireAnswersSection clientId={id!} />
          </div>

          {/* Weekly check-in section */}
          {/* NOTE: id here is the client's publicId (route param). The backend
              GET /trainer/clients/{clientUserId}/weekly-check-ins/current
              expects the ApplicationUser.Id (Guid). Until the backend exposes
              clientUserId in the client dashboard response, this will return
              empty results and the section stays hidden. A follow-up task
              should add clientUserId to GetClientDashboardResponse. */}
          {id && (
            <WeeklyCheckInSection clientUserId={id} />
          )}

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
              <div className="flex gap-3">
                {weightChartData.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-[11px] text-text2 font-medium">{bar.value} kg</div>
                    <div className="w-full relative" style={{ height: 80 }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded"
                        style={{
                          height: `${Math.max(bar.pct, 8)}%`,
                          backgroundColor: bar.highlight ? 'var(--accent)' : 'var(--bg3)',
                        }}
                      />
                    </div>
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
