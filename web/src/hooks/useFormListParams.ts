import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QuestionnaireType } from '@/api/questionnaires';

export const FORMS_PAGE_SIZE = 25;

const VALID_TYPES: readonly string[] = Object.values(QuestionnaireType);

export interface FormListFilters {
  search: string;
  /** `null` means every type. */
  type: QuestionnaireType | null;
  page: number;
  pageSize: number;
}

export interface UseFormListParamsResult {
  filters: FormListFilters;
  /** Sets the search text. Uses `replace` so Back doesn't walk one step per keystroke; resets page to 1. */
  setSearch: (value: string) => void;
  setType: (type: QuestionnaireType | null) => void;
  setPage: (page: number) => void;
  /** Clears the search and the type filter. */
  clearFilters: () => void;
}

type UrlPatch = Partial<Record<'q' | 'type' | 'page', string | null>>;

function parseType(value: string | null): QuestionnaireType | null {
  return value !== null && VALID_TYPES.includes(value) ? (value as QuestionnaireType) : null;
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Owns the Forms list's filter state in the URL: `q`, `type`, `page`. Mirrors `useRecipeListParams`. */
export function useFormListParams(): UseFormListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FormListFilters>(
    () => ({
      search: searchParams.get('q') ?? '',
      type: parseType(searchParams.get('type')),
      page: parsePage(searchParams.get('page')),
      pageSize: FORMS_PAGE_SIZE,
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

  const setType = useCallback(
    (type: QuestionnaireType | null) => {
      update({ type, page: null });
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
    update({ q: null, type: null, page: null });
  }, [update]);

  return { filters, setSearch, setType, setPage, clearFilters };
}
