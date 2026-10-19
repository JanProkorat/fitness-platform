import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRules,
  updateAutomationRule,
  type CreateAutomationRuleRequest,
  type UpdateAutomationRuleRequest,
} from '@/api/automations';
import { useAuthStore } from '@/stores/auth';

export const automationRulesKey = ['automations', 'rules'] as const;

/** The caller's global rules plus the linked weekly check-in rows. */
export function useAutomationRules() {
  const isProfessional = useAuthStore(
    (state) => state.user?.roles.some((role) => role === 'Trainer' || role === 'Nutritionist') ?? false,
  );
  return useQuery({
    queryKey: automationRulesKey,
    queryFn: getAutomationRules,
    enabled: isProfessional,
    retry: false,
  });
}

/**
 * Create and update responses carry no summary, so every settled write refetches the list.
 * Callers show their own errors.
 */
function useRefetchRules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: automationRulesKey });
}

export function useCreateAutomationRule() {
  const refetch = useRefetchRules();
  return useMutation({
    mutationFn: (request: CreateAutomationRuleRequest) => createAutomationRule(request),
    onSettled: () => refetch(),
  });
}

export function useUpdateAutomationRule() {
  const refetch = useRefetchRules();
  return useMutation({
    mutationFn: (variables: { ruleId: string; request: UpdateAutomationRuleRequest }) =>
      updateAutomationRule(variables.ruleId, variables.request),
    onSettled: () => refetch(),
  });
}

export function useDeleteAutomationRule() {
  const refetch = useRefetchRules();
  return useMutation({
    mutationFn: (ruleId: string) => deleteAutomationRule(ruleId),
    onSettled: () => refetch(),
  });
}
