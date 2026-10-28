import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { FOOD_SEARCH_MIN_LENGTH, foodSearchQueryKey, searchFoods } from '@/api/foods';

const DEBOUNCE_MS = 300;

/** Searches foods by name once the typed term settles and is long enough. */
export function useFoodSearch(input: string) {
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setTerm(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const active = term.length >= FOOD_SEARCH_MIN_LENGTH && input.trim() === term;
  const query = useQuery({
    queryKey: foodSearchQueryKey(term),
    queryFn: ({ signal }) => searchFoods(term, signal),
    enabled: active,
    retry: false,
  });
  return { query, active };
}
