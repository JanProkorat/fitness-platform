import { useQuery } from '@tanstack/react-query';
import { getTrainerQuestionnaires } from '@/api/questionnaires';

/** The caller's questionnaires (all, active and inactive). Callers filter `isActive` themselves. */
export function useTrainerQuestionnaires() {
  return useQuery({
    queryKey: ['questionnaires', 'trainer'],
    queryFn: getTrainerQuestionnaires,
  });
}
