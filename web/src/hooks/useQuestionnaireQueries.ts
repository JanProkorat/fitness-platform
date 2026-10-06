import { useQuery } from '@tanstack/react-query';
import { getTrainerQuestionnaires } from '@/api/questionnaires';
import { useAuthStore } from '@/stores/auth';

/** The caller's questionnaires (all, active and inactive). Callers filter `isActive` themselves. */
export function useTrainerQuestionnaires() {
  const isProfessional = useAuthStore(
    (state) => state.user?.roles.some((role) => role === 'Trainer' || role === 'Nutritionist') ?? false,
  );
  return useQuery({
    queryKey: ['questionnaires', 'trainer'],
    queryFn: getTrainerQuestionnaires,
    enabled: isProfessional,
  });
}
