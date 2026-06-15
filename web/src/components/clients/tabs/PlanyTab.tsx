import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getClientPlans } from '@/api/client-plans';
import type { ClientPlanItem, PlanStatus } from '@/api/client-plans';

interface PlanyTabProps {
  clientId: string;
}

// ── Date formatting helpers ───────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

function formatPeriod(periodStart: string | null | undefined, periodEnd: string | null | undefined): string {
  const start = formatDate(periodStart);
  const end = formatDate(periodEnd);
  if (!start && !end) return '—';
  if (start && !end) return `${start} →`;
  if (!start && end) return `→ ${end}`;
  return `${start} – ${end}`;
}

// ── Status chip ───────────────────────────────────────────────────────────────

interface StatusChipProps {
  // Accept string because the generated ClientPlanItem.status field is typed
  // as `string | undefined`; the modifierMap lookup falls back to 'tag-gray'
  // for any unrecognised or undefined value.
  status: string | undefined;
  label: string;
}

function StatusChip({ status, label }: StatusChipProps) {
  // Uses the existing global `.tag` + modifier classes from index.css.
  // Active → green, Completed → gold (accent), Draft/Archived → gray.
  const modifierMap: Record<PlanStatus, string> = {
    Active: 'tag-green',
    Completed: 'tag-acc',
    Draft: 'tag-gray',
    Archived: 'tag-gray',
  };
  const modifier = status != null ? (modifierMap[status as PlanStatus] ?? 'tag-gray') : 'tag-gray';
  return (
    <span className={`tag ${modifier}`}>
      {label}
    </span>
  );
}

// ── Result summary formatter ──────────────────────────────────────────────────

function formatResultSummary(plan: ClientPlanItem, t: TFunction): string {
  const { planType, resultSummary: r } = plan;

  // resultSummary is optional in the generated type; guard before accessing fields.
  if (!r) return '—';

  if (planType === 'Nutrition') {
    const parts: string[] = [];
    if (r.compliancePercent != null) {
      parts.push(
        t('clientDetail.plany.result.compliance', {
          pct: r.compliancePercent.toFixed(0),
        }),
      );
    }
    if (r.weightDeltaKg != null) {
      const sign = r.weightDeltaKg > 0 ? '+' : '';
      const val = r.weightDeltaKg.toFixed(1).replace('.', ',');
      parts.push(
        t('clientDetail.plany.result.weightDelta', {
          delta: `${sign}${val}`,
        }),
      );
    }
    return parts.join(' · ') || '—';
  }

  if (planType === 'Training') {
    const parts: string[] = [];
    if (r.totalTrainings != null) {
      parts.push(
        t('clientDetail.plany.result.totalTrainings', {
          count: r.totalTrainings,
        }),
      );
    }
    if (r.prCount != null) {
      parts.push(
        t('clientDetail.plany.result.prCount', {
          count: r.prCount,
        }),
      );
    }
    return parts.join(' · ') || '—';
  }

  return '—';
}

// ── Plan type emoji prefix ────────────────────────────────────────────────────

function planTypeEmoji(planType: string | undefined): string {
  return planType === 'Nutrition' ? '🥗' : '🏋️';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlanyTab({ clientId }: PlanyTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isPending, isError } = useQuery({
    queryKey: ['client-plans', clientId],
    queryFn: () => getClientPlans(clientId),
    enabled: Boolean(clientId),
    retry: false,
  });

  const plans = data?.plans ?? [];
  const isEmpty = !isPending && !isError && plans.length === 0;

  function handleRowClick(plan: ClientPlanItem) {
    if (!plan.planId) return;
    if (plan.planType === 'Nutrition') {
      navigate(`/clients/${clientId}/plans/${plan.planId}`);
    } else {
      navigate(`/clients/${clientId}/training-plans/${plan.planId}`);
    }
  }

  return (
    <div id="cl-pane-plany">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[15px] font-semibold text-text">
          {t('clientDetail.plany.title')}
        </div>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('common.loading')}
        </div>
      )}

      {/* Error */}
      {isError && !isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('clientDetail.plany.errorLoading')}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-[32px] opacity-40">📋</div>
          <div className="text-[14px] font-medium text-text2">
            {t('clientDetail.plany.emptyTitle')}
          </div>
          <div className="text-[13px] text-text3 max-w-xs">
            {t('clientDetail.plany.emptyDescription')}
          </div>
        </div>
      )}

      {/* Plans table */}
      {!isPending && !isError && plans.length > 0 && (
        <div className="db-wrap overflow-x-auto mb-5">
          <table className="db-table w-full text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.plan')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.type')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.period')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                  {t('clientDetail.plany.table.status')}
                </th>
                <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2">
                  {t('clientDetail.plany.table.result')}
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const statusLabel = t(
                  `clientDetail.plany.status.${(plan.status ?? '').toLowerCase()}`,
                );
                return (
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
                    aria-label={`${t('clientDetail.plany.table.openPlan')} ${plan.name ?? ''}`}
                  >
                    <td className="row-title py-2.5 pr-4 font-medium text-text">
                      <span className="mr-1.5">{planTypeEmoji(plan.planType)}</span>
                      {plan.name}
                    </td>
                    <td className="py-2.5 pr-4 text-text2">
                      {plan.planType === 'Nutrition'
                        ? t('clientDetail.plany.typeLabel.nutrition')
                        : t('clientDetail.plany.typeLabel.training')}
                    </td>
                    <td className="py-2.5 pr-4 text-text2 whitespace-nowrap">
                      {formatPeriod(plan.periodStart, plan.periodEnd)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusChip status={plan.status} label={statusLabel} />
                    </td>
                    <td className="py-2.5 text-text2">
                      {formatResultSummary(plan, t)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action buttons */}
      {!isPending && !isError && (
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors"
            onClick={() => navigate(`/clients/${clientId}/nutrition`)}
          >
            + {t('clientDetail.plany.actions.newNutrition')}
          </button>
          <button
            type="button"
            className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors"
            onClick={() => navigate(`/clients/${clientId}/training`)}
          >
            + {t('clientDetail.plany.actions.newTraining')}
          </button>
        </div>
      )}
    </div>
  );
}
