import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getPlans } from '@/api/plans';
import { getTrainingPlans } from '@/api/training-plans';
import { sortPlansNewestFirst } from '@/lib/plan-window';
import type { PlanCreateType } from '@/components/clients/PlanCreateDialog';

interface SidebarPlanSubmenuProps {
  clientId: string;
  planType: PlanCreateType;
  /** Closes the mobile drawer (mirrors the sibling nav links' onClick=onClose). */
  onNavigate?: () => void;
}

/**
 * Submenu rendered under the sidebar's "Jidelnicek"/"Treninkovy plan" nav
 * rows when expanded (#780 AC4) — lists that plan type's individual plans,
 * newest first. Row click opens the plan's editor directly, matching the
 * existing Plany-tab row-click behaviour.
 */
export function SidebarPlanSubmenu({ clientId, planType, onNavigate }: SidebarPlanSubmenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const nutritionQuery = useQuery({
    queryKey: ['plans', { clientId, all: true }],
    queryFn: () => getPlans({ clientId, pageSize: 100 }),
    enabled: planType === 'nutrition',
  });
  const trainingQuery = useQuery({
    queryKey: ['training-plans', { clientId, all: true }],
    queryFn: () => getTrainingPlans({ clientId, pageSize: 100 }),
    enabled: planType === 'training',
  });

  const isPending = planType === 'nutrition' ? nutritionQuery.isPending : trainingQuery.isPending;
  const plans =
    planType === 'nutrition'
      ? sortPlansNewestFirst(nutritionQuery.data?.plans ?? [])
      : sortPlansNewestFirst(trainingQuery.data?.plans ?? []);

  function handleRowClick(planId: string) {
    navigate(planType === 'nutrition' ? `/clients/${clientId}/plans/${planId}` : `/clients/${clientId}/training-plans/${planId}`);
    onNavigate?.();
  }

  return (
    <div>
      {isPending && (
        <div style={{ paddingLeft: 44, fontSize: 11, color: 'var(--text3)', padding: '4px 10px 4px 44px' }}>
          {t('common.loading')}
        </div>
      )}
      {!isPending && plans.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 10px 4px 44px' }}>
          {t('sidebar.planSubmenu.empty')}
        </div>
      )}
      {!isPending &&
        plans.map((plan) => (
          <button
            key={plan.planId}
            type="button"
            className="sb-item"
            style={{ paddingLeft: 44, width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
            onClick={() => handleRowClick(plan.planId)}
          >
            <span className="sbi-lbl" style={{ fontSize: 12 }}>{plan.name}</span>
          </button>
        ))}
    </div>
  );
}
