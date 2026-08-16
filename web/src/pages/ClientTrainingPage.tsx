import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getTrainingPlans } from '@/api/training-plans';
import { getClientDashboard } from '@/api/nutrition-goals';
import { useAuthStore } from '@/stores/auth';
import type { TrainingPlanSummary } from '@/api/training-plan-types';
import { sortPlansNewestFirst } from '@/lib/plan-window';
import { formatClientDatePeriod } from '@/lib/date-format';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/clients/EmptyState';
import { PlanStatusChip } from '@/components/clients/PlanStatusChip';
import { PlanCreateDialog } from '@/components/clients/PlanCreateDialog';
import i18n from '@/i18n';

/**
 * Lists every training plan ("Treninkovy plan") of a client, newest first
 * (#780 AC4). Previously this route auto-resolved/auto-created a single
 * plan and redirected straight to its editor — now it's a list page: a "+"
 * action opens the create dialog (AC2), and each row opens that plan's
 * editor at /clients/:id/training-plans/:planId.
 *
 * Route-level `RoleGuard` (App.tsx) already restricts this route to
 * Trainer/Admin; the per-client `canViewTrainingPlans` link permission
 * (independent of role, #735) is checked here the same way the previous
 * auto-redirect wrapper did.
 */
export default function ClientTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canManageTraining = Boolean(user?.roles.some((r) => ['Trainer', 'Admin'].includes(r)));
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: client,
    isLoading: clientLoading,
    isError: clientError,
  } = useQuery({
    queryKey: ['client-dashboard', clientId],
    queryFn: () => getClientDashboard(clientId),
    enabled: Boolean(clientId),
  });

  const clientLoaded = client !== undefined;
  const canViewTrainingPlans = client?.canViewTrainingPlans === true;

  const { data, isPending, isError } = useQuery({
    queryKey: ['training-plans', { clientId, all: true }],
    queryFn: () => getTrainingPlans({ clientId, pageSize: 100 }),
    enabled: Boolean(clientId) && canManageTraining && clientLoaded && canViewTrainingPlans,
  });

  const plans = useMemo(() => sortPlansNewestFirst(data?.plans ?? []), [data]);
  const isEmpty = !isPending && !isError && plans.length === 0;

  function handleRowClick(plan: TrainingPlanSummary) {
    navigate(`/clients/${clientId}/training-plans/${plan.planId}`);
  }

  function handleCreated(planId: string) {
    setCreateOpen(false);
    navigate(`/clients/${clientId}/training-plans/${planId}`);
  }

  if (!canManageTraining) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontSize: 14 }}>{t('clientTraining.roleDenied')}</p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard', { replace: true })}
        >
          {t('clientTraining.back')}
        </button>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
        {t('clientTraining.loading')}
      </div>
    );
  }

  if (clientError && !clientLoaded) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontSize: 14 }}>{t('clientTraining.clientLoadError')}</p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard', { replace: true })}
        >
          {t('clientTraining.back')}
        </button>
      </div>
    );
  }

  if (clientLoaded && !canViewTrainingPlans) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontSize: 14 }}>{t('clientTraining.accessDenied')}</p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard', { replace: true })}
        >
          {t('clientTraining.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[17px] font-semibold text-text">{t('clientTraining.list.title')}</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + {t('clientTraining.list.newPlan')}
        </Button>
      </div>

      {isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">{t('common.loading')}</div>
      )}

      {isError && !isPending && (
        <div className="text-[13px] text-red py-12 text-center">{t('clientTraining.loadError')}</div>
      )}

      {isEmpty && (
        <EmptyState
          icon="🏋️"
          title={t('clientTraining.list.emptyTitle')}
          description={t('clientTraining.list.emptyDescription')}
        />
      )}

      {!isPending && !isError && plans.length > 0 && (
        <div className="db-wrap overflow-x-auto">
          <table className="db-table w-full text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.plan')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.period')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2">
                  {t('clientDetail.plany.table.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.planId}
                  className="border-t border-border cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => handleRowClick(plan)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(plan);
                    }
                  }}
                  aria-label={`${t('clientDetail.plany.table.openPlan')} ${plan.name}`}
                >
                  <td className="row-title py-2.5 pr-4 font-medium text-text">{plan.name}</td>
                  <td className="py-2.5 pr-4 text-text2 whitespace-nowrap">
                    {formatClientDatePeriod(plan.startDate, plan.dateCompleted, i18n.language)}
                  </td>
                  <td className="py-2.5">
                    <PlanStatusChip status={plan.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clientId={clientId}
        planType="training"
        onCreated={handleCreated}
      />
    </div>
  );
}
