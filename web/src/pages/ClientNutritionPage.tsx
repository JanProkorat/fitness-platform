import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getPlans } from '@/api/plans';
import type { PlanSummary } from '@/api/plan-types';
import { sortPlansNewestFirst } from '@/lib/plan-window';
import { formatClientDatePeriod } from '@/lib/date-format';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/clients/EmptyState';
import { PlanStatusChip } from '@/components/clients/PlanStatusChip';
import { PlanCreateDialog } from '@/components/clients/PlanCreateDialog';
import i18n from '@/i18n';

/**
 * Lists every nutrition plan ("Jidelnicek") of a client, newest first
 * (#780 AC4). Previously this route auto-resolved/auto-created a single
 * plan and redirected straight to its editor — now it's a list page: a "+"
 * action opens the create dialog (AC2), and each row opens that plan's
 * editor at /clients/:id/plans/:planId.
 */
export default function ClientNutritionPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ['plans', { clientId, all: true }],
    queryFn: () => getPlans({ clientId, pageSize: 100 }),
    enabled: Boolean(clientId),
  });

  const plans = useMemo(() => sortPlansNewestFirst(data?.plans ?? []), [data]);
  const isEmpty = !isPending && !isError && plans.length === 0;

  function handleRowClick(plan: PlanSummary) {
    navigate(`/clients/${clientId}/plans/${plan.planId}`);
  }

  function handleCreated(planId: string) {
    setCreateOpen(false);
    navigate(`/clients/${clientId}/plans/${planId}`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[17px] font-semibold text-text">{t('clientNutrition.list.title')}</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + {t('clientNutrition.list.newPlan')}
        </Button>
      </div>

      {isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">{t('common.loading')}</div>
      )}

      {isError && !isPending && (
        <div className="text-[13px] text-red py-12 text-center">{t('clientNutrition.loadError')}</div>
      )}

      {isEmpty && (
        <EmptyState
          icon="🥗"
          title={t('clientNutrition.list.emptyTitle')}
          description={t('clientNutrition.list.emptyDescription')}
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
        planType="nutrition"
        onCreated={handleCreated}
      />
    </div>
  );
}
