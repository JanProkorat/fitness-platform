import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrimaryGoal } from '@/api/nutrition-plan-templates';

export const PLAN_TEMPLATES_PAGE_SIZE = 25;

const VALID_GOALS: readonly string[] = Object.values(PrimaryGoal);

export interface PlanTemplateListFilters {
  search: string;
  goal: PrimaryGoal | null;
  weekCount: number | null;
  mealsPerDay: number | null;
  inUse: boolean | null;
  page: number;
  pageSize: number;
}

export interface UsePlanTemplateListParamsResult {
  filters: PlanTemplateListFilters;
  /** Uses `replace` so Back doesn't walk one step per keystroke; resets page to 1. */
  setSearch: (value: string) => void;
  setGoal: (goal: PrimaryGoal | null) => void;
  setWeekCount: (weeks: number | null) => void;
  setMealsPerDay: (meals: number | null) => void;
  setInUse: (inUse: boolean | null) => void;
  setPage: (page: number) => void;
  /** Clears search and every filter. */
  clearFilters: () => void;
}

function parsePositiveInt(value: string | null): number | null {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseGoal(value: string | null): PrimaryGoal | null {
  return value !== null && VALID_GOALS.includes(value) ? (value as PrimaryGoal) : null;
}

function parseInUse(value: string | null): boolean | null {
  if (value === 'yes') {
    return true;
  }
  return value === 'no' ? false : null;
}

type UrlPatch = Partial<Record<'q' | 'goal' | 'weeks' | 'meals' | 'inUse' | 'page', string | null>>;

/** Owns the plan-templates list's filter state in the URL: `q`, `goal`, `weeks`, `meals`, `inUse`, `page`. */
export function usePlanTemplateListParams(): UsePlanTemplateListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<PlanTemplateListFilters>(() => {
    const page = parsePositiveInt(searchParams.get('page')) ?? 1;
    return {
      search: searchParams.get('q') ?? '',
      goal: parseGoal(searchParams.get('goal')),
      weekCount: parsePositiveInt(searchParams.get('weeks')),
      mealsPerDay: parsePositiveInt(searchParams.get('meals')),
      inUse: parseInUse(searchParams.get('inUse')),
      page,
      pageSize: PLAN_TEMPLATES_PAGE_SIZE,
    };
  }, [searchParams]);

  const update = useCallback(
    (patch: UrlPatch, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: options.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback((value: string) => update({ q: value || null, page: null }, { replace: true }), [update]);
  const setGoal = useCallback((goal: PrimaryGoal | null) => update({ goal, page: null }), [update]);
  const setWeekCount = useCallback(
    (weeks: number | null) => update({ weeks: weeks === null ? null : String(weeks), page: null }),
    [update],
  );
  const setMealsPerDay = useCallback(
    (meals: number | null) => update({ meals: meals === null ? null : String(meals), page: null }),
    [update],
  );
  const setInUse = useCallback(
    (inUse: boolean | null) => update({ inUse: inUse === null ? null : inUse ? 'yes' : 'no', page: null }),
    [update],
  );
  const setPage = useCallback((page: number) => update({ page: page > 1 ? String(page) : null }), [update]);
  const clearFilters = useCallback(
    () => update({ q: null, goal: null, weeks: null, meals: null, inUse: null, page: null }),
    [update],
  );

  return { filters, setSearch, setGoal, setWeekCount, setMealsPerDay, setInUse, setPage, clearFilters };
}
