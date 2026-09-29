import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FoodCategory } from '@/api/food-types';

export const INGREDIENTS_PAGE_SIZE = 25;

const VALID_CATEGORIES: readonly string[] = Object.values(FoodCategory);

export interface IngredientListFilters {
  search: string;
  category?: FoodCategory;
  tags: string[];
  page: number;
  pageSize: number;
}

export interface UseIngredientListParamsResult {
  filters: IngredientListFilters;
  /** Sets the search text. Uses `replace` (not `push`) so Back doesn't walk
   * one step per keystroke; resets page to 1. */
  setSearch: (value: string) => void;
  /** Sets (or clears, via `undefined`) the category filter. Pushes a history
   * entry; resets page to 1. */
  setCategory: (category: FoodCategory | undefined) => void;
  /** Replaces the full selected-tags set. Pushes a history entry; resets page to 1. */
  setTags: (tags: string[]) => void;
  /** Navigates to a page. Pushes a history entry. */
  setPage: (page: number) => void;
  /** Clears category, tags and search back to defaults. */
  clearFilters: () => void;
}

function parseCategory(value: string | null): FoodCategory | undefined {
  return VALID_CATEGORIES.includes(value ?? '') ? (value as FoodCategory) : undefined;
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

type UrlPatch = Partial<Record<'q' | 'category' | 'tags' | 'page', string | null>>;

/**
 * Owns the ingredients-list page's filter state entirely in the URL — `q`,
 * `category`, `tags`, `page`. Mirrors `useClientListParams` (`@/hooks/useClientListParams.ts`).
 * Component state holds only what isn't a filter (the raw, undebounced
 * search input, drawer-open state).
 */
export function useIngredientListParams(): UseIngredientListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<IngredientListFilters>(
    () => ({
      search: searchParams.get('q') ?? '',
      category: parseCategory(searchParams.get('category')),
      tags: parseTags(searchParams.get('tags')),
      page: parsePage(searchParams.get('page')),
      pageSize: INGREDIENTS_PAGE_SIZE,
    }),
    [searchParams],
  );

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

  const setSearch = useCallback(
    (value: string) => {
      update({ q: value || null, page: null }, { replace: true });
    },
    [update],
  );

  const setCategory = useCallback(
    (category: FoodCategory | undefined) => {
      update({ category: category ?? null, page: null });
    },
    [update],
  );

  const setTags = useCallback(
    (tags: string[]) => {
      const deduped = Array.from(new Set(tags));
      update({ tags: deduped.length ? deduped.join(',') : null, page: null });
    },
    [update],
  );

  const setPage = useCallback(
    (page: number) => {
      update({ page: page > 1 ? String(page) : null });
    },
    [update],
  );

  const clearFilters = useCallback(() => {
    update({ category: null, tags: null, q: null, page: null });
  }, [update]);

  return { filters, setSearch, setCategory, setTags, setPage, clearFilters };
}
