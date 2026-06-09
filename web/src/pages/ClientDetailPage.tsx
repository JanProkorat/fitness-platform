import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getClientDashboard } from '@/api/nutrition-goals';
import { getClientVerdict } from '@/api/client-verdict';
import { getPlans, getPlan } from '@/api/plans';
import { getTrainingPlans } from '@/api/training-plans';
import { getClientTimeline } from '@/api/timeline';
import { useRecentActivityAggregates } from '@/components/domain/RecentActivity/useRecentActivityAggregates';

import { Button, Dialog, Input } from '@/components/ui';
import { IdentityStrip } from '@/components/clients/IdentityStrip';
import { ClientTabBar, type ClientTabId } from '@/components/clients/ClientTabBar';
import {
  VerdictHeroCard,
  VerdictHeroCardError,
  VerdictHeroCardSkeleton,
} from '@/components/clients/VerdictHeroCard';
import { ActiveNutritionPlanCard } from '@/components/clients/ActiveNutritionPlanCard';
import { ActiveTrainingPlanCard } from '@/components/clients/ActiveTrainingPlanCard';
import { PlanCardPlaceholder } from '@/components/clients/PlanCardPlaceholder';
import { ProgressSnapshot } from '@/components/clients/ProgressSnapshot';
import { MereniTab } from '@/components/clients/tabs/MereniTab';
import { FotkyTab } from '@/components/clients/tabs/FotkyTab';
import { AktivitaTab } from '@/components/clients/tabs/AktivitaTab';
import { PlanyTab } from '@/components/clients/tabs/PlanyTab';
import { CheckinyTab } from '@/components/clients/tabs/CheckinyTab';
import { DotaznikyTab } from '@/components/clients/tabs/DotaznikyTab';
import { PoznamkyTab } from '@/components/clients/tabs/PoznamkyTab';
import type { PlanSummary } from '@/api/plan-types';
import type { TrainingPlanSummary } from '@/api/training-plan-types';

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTabId>('prehled');

  // ── Server state ─────────────────────────────────────────────────────────────

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const {
    data: verdict,
    isError: verdictError,
    isLoading: verdictLoading,
  } = useQuery({
    queryKey: ['client-verdict', id],
    queryFn: () => getClientVerdict(id!),
    enabled: !!id && client?.hasRegistered === true,
    // Non-fatal: 404/403 surfaces as error state, not page crash
    retry: false,
  });

  const { data: nutritionPlans } = useQuery({
    queryKey: ['plans', { clientId: id, status: 'Active' }],
    queryFn: () => getPlans({ clientId: id, status: 'Active', pageSize: 1 }),
    enabled: !!id && client?.hasRegistered === true,
  });

  const { data: trainingPlans } = useQuery({
    queryKey: ['training-plans', { clientId: id, status: 'Active' }],
    queryFn: () => getTrainingPlans({ clientId: id, status: 'Active', pageSize: 1 }),
    enabled: !!id && client?.hasRegistered === true,
  });

  // ── Derived values ───────────────────────────────────────────────────────────

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const clientInitials = client
    ? `${(client.firstName ?? '?')[0]}${(client.lastName ?? '?')[0]}`.toUpperCase()
    : '?';

  const ob = client?.onboarding;

  const clientAge = useMemo(() => {
    if (!client?.dateOfBirth) return null;
    const birth = new Date(client.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [client?.dateOfBirth]);

  const activeNutritionPlanSummary: PlanSummary | null =
    nutritionPlans?.plans?.[0] ?? null;

  const activeTrainingPlan: TrainingPlanSummary | null =
    trainingPlans?.plans?.[0] ?? null;

  // Fetch the active nutrition plan detail to get globalSettings (macros).
  // PlanSummary does not carry globalSettings — the detail does.
  const { data: activeNutritionPlanDetail } = useQuery({
    queryKey: ['plan', activeNutritionPlanSummary?.planId],
    queryFn: () => getPlan(activeNutritionPlanSummary!.planId),
    enabled: !!activeNutritionPlanSummary?.planId,
  });

  // Fetch the client timeline so we can derive the top PR for the training card.
  const { data: timelineData } = useQuery({
    queryKey: ['client-timeline', id],
    queryFn: () => getClientTimeline(id!, 50),
    enabled: !!id && client?.hasRegistered === true,
  });

  const { topPr } = useRecentActivityAggregates(timelineData?.items ?? []);

  const startWeight = client?.weightKg ?? null;
  const currentWeight = client?.latestMeasurement?.weightKg ?? startWeight;
  const targetWeight = ob?.targetWeightKg ?? null;

  // ── Loading / error states ───────────────────────────────────────────────────

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-text3">
        {t('common.loading')}
      </div>
    );
  }

  if (!client) return null;

  // Pending-invite state: client has not registered yet
  if (client.hasRegistered === false) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-20 py-7">
          <h1 className="text-text mb-1">{clientName}</h1>
          <div className="text-[13px] text-text3 mb-5">{client.email}</div>
          <div
            className="max-w-[480px] rounded-[var(--radius-md)] p-6"
            style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-br)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-[28px]">✉️</span>
              <div>
                <div className="text-[15px] font-semibold text-text">
                  {t('clientDetail.pendingInvite.title')}
                </div>
                <div className="text-[13px] text-text2 mt-0.5">{client.email}</div>
              </div>
            </div>
            <div className="text-[13px] text-text2 leading-relaxed">
              {t('clientDetail.pendingInvite.description')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Identity strip — pinned above tab bar */}
      <IdentityStrip
        client={client}
        clientId={id!}
        clientInitials={clientInitials}
        clientAge={clientAge}
        onEditProfile={() => setEditDialogOpen(true)}
        onPhotoDiary={() => {
          // Photo diary action — to be wired by wave-3 Fotky sub-issue
        }}
      />

      {/* Gold-chip tab bar */}
      <ClientTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Pane content — scrolls independently */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-5">

          {/* ── PŘEHLED PANE ── */}
          {activeTab === 'prehled' && (
            <div
              id="cl-pane-prehled"
              role="tabpanel"
              aria-labelledby="cl-tab-prehled"
              className="tab-content-transition"
            >
              {/* Verdict hero card */}
              {verdictLoading && <VerdictHeroCardSkeleton />}
              {verdictError && <VerdictHeroCardError />}
              {verdict && !verdictError && (
                <VerdictHeroCard verdict={verdict} />
              )}

              {/* Active plan cards (nutrition + training side by side) */}
              <div className="grid grid-cols-2 gap-3.5 mb-4">
                {activeNutritionPlanSummary ? (
                  <ActiveNutritionPlanCard
                    plan={activeNutritionPlanSummary}
                    globalSettings={activeNutritionPlanDetail?.globalSettings}
                    targetWeightKg={ob?.targetWeightKg}
                    goalLabel={ob?.derivedNutritionGoal ?? ob?.primaryGoal}
                    compliancePercent={client.compliancePercent}
                    onHistoryClick={() => setActiveTab('plany')}
                  />
                ) : (
                  <PlanCardPlaceholder
                    type="nutrition"
                    onCreatePlan={() => navigate(`/nutrition/plans/new?clientId=${id}`)}
                  />
                )}

                {activeTrainingPlan ? (
                  <ActiveTrainingPlanCard
                    plan={activeTrainingPlan}
                    trainingFrequencyActual={verdict?.trainingFrequencyActual}
                    trainingFrequencyPrescribed={verdict?.trainingFrequencyPrescribed}
                    prCountThisMonth={verdict?.prCountThisMonth}
                    topPr={topPr}
                    onHistoryClick={() => setActiveTab('plany')}
                  />
                ) : (
                  <PlanCardPlaceholder
                    type="training"
                    onCreatePlan={() => navigate(`/training/plans/new?clientId=${id}`)}
                  />
                )}
              </div>

              {/* Progress snapshot */}
              <ProgressSnapshot
                startWeight={startWeight}
                currentWeight={currentWeight}
                targetWeight={targetWeight}
                verdict={verdict ?? null}
                onAllMeasurementsClick={() => setActiveTab('mereni')}
              />
            </div>
          )}

          {/* ── PLACEHOLDER PANES ── (wave-3 children fill these)
              NOTE: id="cl-pane-<id>" lives on each placeholder component's root div,
              not on this wrapper, to avoid duplicate DOM ids. */}
          {activeTab === 'mereni' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-mereni"
              className="tab-content-transition"
            >
              <MereniTab
                clientId={id!}
                targetWeightKg={ob?.targetWeightKg ?? null}
              />
            </div>
          )}

          {activeTab === 'fotky' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-fotky"
              className="tab-content-transition"
            >
              <FotkyTab
                clientId={id!}
                clientName={clientName}
                clientInitials={clientInitials}
                linkId={client.linkId}
                activeNutritionPlan={activeNutritionPlanSummary}
                activeTrainingPlan={activeTrainingPlan}
              />
            </div>
          )}

          {activeTab === 'aktivita' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-aktivita"
              className="tab-content-transition"
            >
              <AktivitaTab clientId={id!} />
            </div>
          )}

          {activeTab === 'plany' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-plany"
              className="tab-content-transition"
            >
              <PlanyTab clientId={id!} />
            </div>
          )}

          {activeTab === 'checkiny' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-checkiny"
              className="tab-content-transition"
            >
              <CheckinyTab clientUserId={id!} />
            </div>
          )}

          {activeTab === 'dotazniky' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-dotazniky"
              className="tab-content-transition"
            >
              <DotaznikyTab clientId={id!} />
            </div>
          )}

          {activeTab === 'poznamky' && (
            <div
              role="tabpanel"
              aria-labelledby="cl-tab-poznamky"
              className="tab-content-transition"
            >
              <PoznamkyTab />
            </div>
          )}
        </div>
      </div>

      {/* Edit client dialog (unchanged from original) */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={t('clients.editProfile')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => setEditDialogOpen(false)}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-0">
          <Input
            label={t('common.name')}
            defaultValue={client?.firstName ?? ''}
            placeholder={t('common.name')}
          />
          <Input
            label={t('clientDetail.lastName')}
            defaultValue={client?.lastName ?? ''}
            placeholder={t('clientDetail.lastName')}
          />
          <Input
            label={t('common.email')}
            defaultValue={client?.email ?? ''}
            placeholder={t('common.email')}
            type="email"
          />
          <Input
            label={t('clientDetail.heightCm')}
            defaultValue={client?.heightCm?.toString() ?? ''}
            placeholder="168"
            type="number"
          />
          <Input
            label={t('clientDetail.weightKg')}
            defaultValue={client?.weightKg?.toString() ?? ''}
            placeholder="63"
            type="number"
          />
        </div>
      </Dialog>
    </div>
  );
}
