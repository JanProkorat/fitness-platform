import { useInfiniteQuery } from '@tanstack/react-query'
import { searchProfessionals, type SearchResponse } from '../api/professionals'

interface UseTrainersParams {
  search: string
  role: 'all' | 'trainer' | 'coach'
  goal: string
  enabled?: boolean
}

const ROLE_API_MAP: Record<string, string | undefined> = {
  all: undefined,
  trainer: 'Trainer',
  coach: 'Nutritionist',
}

export function useTrainers({ search, role, goal, enabled = true }: UseTrainersParams) {
  return useInfiniteQuery<SearchResponse>({
    queryKey: ['trainers', search, role, goal],
    queryFn: ({ pageParam }) =>
      searchProfessionals({
        search: search || undefined,
        role: ROLE_API_MAP[role],
        specialization: goal || undefined,
        page: pageParam as number,
        pageSize: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1
      const totalPages = Math.ceil(lastPage.totalCount / lastPage.pageSize)
      return nextPage <= totalPages ? nextPage : undefined
    },
    enabled,
  })
}
