import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClientOverviewRole } from '@/lib/client-metrics';
import type { ClientHeaderFacts as ClientHeaderFactsModel, FactState, PlanFact } from '@/components/client-detail/useClientHeaderFacts';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  clientId: string;
  dashboard: GetClientDashboardResponse;
  role: ClientOverviewRole;
  facts: ClientHeaderFactsModel;
}

const EMPTY_VALUE = '—';

const FACT_LINK_CLASS =
  'rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-l border-border px-5.5 py-0.5 first:border-l-0 first:pl-0 last:pr-0">
      <dt className="text-label font-semibold uppercase tracking-caps text-muted-foreground">{label}</dt>
      <dd className="m-0 whitespace-nowrap font-display text-panel-title font-semibold text-ink">{children}</dd>
    </div>
  );
}

function FactSkeleton() {
  return <Skeleton className="h-5 w-16" />;
}

/**
 * Goal, weight and plan-week facts for the client-detail header (board
 * PageClientDetail). Each fact has its own loading and error state: a failed
 * query shows a dash, never a retry (the tab bodies own retry).
 */
export default function ClientHeaderFacts({ clientId, dashboard, role, facts }: Props) {
  const { t, i18n } = useTranslation();

  const goal = dashboard.onboarding?.primaryGoal;

  function renderPlan(state: FactState<PlanFact>, linkTo?: { clientId: string }): ReactNode {
    if (state.status === 'loading') {
      return <FactSkeleton />;
    }
    if (state.status === 'error') {
      return EMPTY_VALUE;
    }
    const { value } = state;
    if (value.kind === 'unknown') {
      if (linkTo && value.planId) {
        return (
          <Link
            to={`/clients/${linkTo.clientId}/nutrition/plans/${value.planId}`}
            aria-label={t('clientDetail.overview.header.facts.openMealPlan')}
            className={FACT_LINK_CLASS}
          >
            {EMPTY_VALUE}
          </Link>
        );
      }
      return EMPTY_VALUE;
    }
    if (value.kind === 'none') {
      const text = <span className="font-sans text-body font-medium text-muted-foreground">{t('clientDetail.overview.header.facts.noPlan')}</span>;
      return linkTo ? (
        <Link
          to={`/clients/${linkTo.clientId}/nutrition`}
          aria-label={t('clientDetail.overview.header.facts.startMealPlan')}
          className={FACT_LINK_CLASS}
        >
          {text}
        </Link>
      ) : (
        text
      );
    }
    const label = t('clientDetail.overview.header.facts.weekOf', { week: value.week, total: value.total });
    if (linkTo && value.planId) {
      return (
        <Link
          to={`/clients/${linkTo.clientId}/nutrition/plans/${value.planId}`}
          aria-label={t('clientDetail.overview.header.facts.openMealPlanWeek', { week: value.week, total: value.total })}
          className={FACT_LINK_CLASS}
        >
          {label}
        </Link>
      );
    }
    return label;
  }

  function renderWeight(): ReactNode {
    const state = facts.weight;
    if (state.status === 'loading') {
      return <FactSkeleton />;
    }
    if (state.status === 'error' || state.value === null) {
      return EMPTY_VALUE;
    }
    const { latestKg, changeKg, towardGoal } = state.value;
    const kg = (value: number) =>
      t('clientDetail.overview.header.facts.kg', { value: value.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
    return (
      <>
        {kg(latestKg)}
        {changeKg != null && (
          <span
            data-testid="client-weight-change"
            className={`ml-1.5 inline-flex items-center gap-0.5 font-sans text-meta font-semibold ${towardGoal ? 'text-success' : 'text-muted-foreground'}`}
          >
            {changeKg < 0 && (
              <ArrowDown
                className="size-3"
                role="img"
                aria-label={t('clientDetail.overview.header.facts.weightDown')}
              />
            )}
            {changeKg > 0 && (
              <ArrowUp className="size-3" role="img" aria-label={t('clientDetail.overview.header.facts.weightUp')} />
            )}
            {kg(Math.abs(changeKg))}
          </span>
        )}
      </>
    );
  }

  const entries: { key: string; label: string; content: ReactNode }[] = [
    {
      key: 'goal',
      label: t('clientDetail.overview.header.facts.goal'),
      content: goal ? t(`nutritionGoals.goal_${goal}`) : EMPTY_VALUE,
    },
    { key: 'weight', label: t('clientDetail.overview.header.facts.weight'), content: renderWeight() },
  ];
  if (role !== 'trainer') {
    entries.push({
      key: 'mealPlan',
      label: t('clientDetail.overview.header.facts.mealPlan'),
      content: renderPlan(facts.mealPlan, { clientId }),
    });
  }
  if (role !== 'nutritionist') {
    entries.push({
      key: 'trainingPlan',
      label: t('clientDetail.overview.header.facts.trainingPlan'),
      content: renderPlan(facts.trainingPlan),
    });
  }

  return (
    <dl className="m-0 flex flex-wrap" data-testid="client-header-facts">
      {entries.map((entry) => (
        <Fact key={entry.key} label={entry.label}>
          {entry.content}
        </Fact>
      ))}
    </dl>
  );
}
