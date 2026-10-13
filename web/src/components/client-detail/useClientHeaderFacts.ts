import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getClientMeasurements } from '@/api/measurements';
import { getTrainingPlan } from '@/api/training-plans';
import { resolveOverviewRole } from '@/lib/client-metrics';
import {
  OLDEST_MEASUREMENTS_PAGE_SIZE,
  isMovingTowardGoal,
  oldestMeasurementsPage,
  planWeekOf,
  summarizeWeight,
} from '@/lib/client-header-facts';
import { todayCalendarDate } from '@/components/client-detail/nutrition/nutritionPlanView';
import type { GetClientDashboardResponse, GetMeasurementsResponse, ListClientPlansResponse } from '@/api/generated';

export type FactState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

export interface WeightFact {
  latestKg: number;
  changeKg?: number;
  towardGoal: boolean;
}

/** `none`: no Active plan of that type; `unknown`: Active but its week cannot be worked out. */
export type PlanFact = { kind: 'none' } | { kind: 'unknown' } | { kind: 'week'; week: number; total: number };

export interface ClientHeaderFacts {
  /** `null` value: the client has no weighed measurement. */
  weight: FactState<WeightFact | null>;
  mealPlan: FactState<PlanFact>;
  trainingPlan: FactState<PlanFact>;
}

/**
 * Facts for the client-detail header strip. The dashboard, plans and first
 * measurements page come from the page (same query keys as the tabs); this adds
 * the oldest measurements page and the Active training plan's detail.
 */
export function useClientHeaderFacts(
  clientId: string,
  dashboard: GetClientDashboardResponse,
  plansQuery: UseQueryResult<ListClientPlansResponse>,
  measurementsQuery: UseQueryResult<GetMeasurementsResponse>,
): ClientHeaderFacts {
  const role = resolveOverviewRole(dashboard.canViewNutritionPlans, dashboard.canViewTrainingPlans);
  const today = todayCalendarDate();

  const firstPageItems = measurementsQuery.data?.items;
  const oldestPage = oldestMeasurementsPage(measurementsQuery.data?.totalCount, firstPageItems?.length ?? 0);

  const oldestQuery = useQuery({
    queryKey: ['client-measurements', clientId, 'oldest'],
    queryFn: () => getClientMeasurements(clientId, oldestPage, OLDEST_MEASUREMENTS_PAGE_SIZE),
    enabled: Boolean(clientId) && oldestPage != null,
  });

  const plans = plansQuery.data?.plans;
  const activeNutrition = plans?.find((p) => p.planType === 'Nutrition' && p.status === 'Active');
  const activeTraining = plans?.find((p) => p.planType === 'Training' && p.status === 'Active');

  const trainingDetailQuery = useQuery({
    queryKey: ['training-plan-detail', activeTraining?.planId],
    queryFn: () => getTrainingPlan(activeTraining!.planId!),
    enabled: role !== 'nutritionist' && Boolean(activeTraining?.planId),
  });

  let weight: ClientHeaderFacts['weight'];
  if (measurementsQuery.isPending || (oldestPage != null && oldestQuery.isPending)) {
    weight = { status: 'loading' };
  } else if (measurementsQuery.isError) {
    weight = { status: 'error' };
  } else {
    const summary = summarizeWeight(firstPageItems, oldestQuery.data?.items);
    if (!summary) {
      weight = { status: 'ready', value: null };
    } else {
      const towardGoal =
        summary.changeKg != null &&
        summary.baselineKg != null &&
        isMovingTowardGoal(
          summary.baselineKg,
          summary.changeKg,
          dashboard.onboarding?.targetWeightKg,
          dashboard.onboarding?.primaryGoal,
        );
      weight = { status: 'ready', value: { latestKg: summary.latestKg, changeKg: summary.changeKg, towardGoal } };
    }
  }

  let mealPlan: ClientHeaderFacts['mealPlan'];
  let trainingPlan: ClientHeaderFacts['trainingPlan'];
  if (plansQuery.isPending) {
    mealPlan = { status: 'loading' };
    trainingPlan = { status: 'loading' };
  } else if (plansQuery.isError) {
    mealPlan = { status: 'error' };
    trainingPlan = { status: 'error' };
  } else {
    if (!activeNutrition) {
      mealPlan = { status: 'ready', value: { kind: 'none' } };
    } else {
      const week = planWeekOf(activeNutrition.periodStart, activeNutrition.weekCount, today);
      mealPlan = { status: 'ready', value: week ? { kind: 'week', ...week } : { kind: 'unknown' } };
    }

    if (!activeTraining) {
      trainingPlan = { status: 'ready', value: { kind: 'none' } };
    } else if (trainingDetailQuery.isPending) {
      trainingPlan = { status: 'loading' };
    } else if (trainingDetailQuery.isError) {
      trainingPlan = { status: 'error' };
    } else {
      const week = planWeekOf(activeTraining.periodStart, trainingDetailQuery.data?.weeks.length, today);
      trainingPlan = { status: 'ready', value: week ? { kind: 'week', ...week } : { kind: 'unknown' } };
    }
  }

  return { weight, mealPlan, trainingPlan };
}
