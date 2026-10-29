import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { clientQuestionnaireQueryKey, fetchClientQuestionnaire } from '@/api/questionnaires';
import type { ClientQuestionnaire } from '@/api/questionnaires';
import { EMPTY_DRAFT, buildSteps, prefillDrafts } from '@/components/questionnaire/fillModel';
import type { Draft, Drafts } from '@/components/questionnaire/fillModel';

/**
 * Loads one coach's questionnaire with any saved answers. It is read once: a refetch while the client
 * is typing would not overwrite the draft, but it would also never be needed, so it is switched off.
 */
export function useClientQuestionnaire(linkPublicId: string | null, responsePublicId: string | null) {
  return useQuery({
    queryKey: clientQuestionnaireQueryKey(linkPublicId ?? '', responsePublicId),
    queryFn: ({ signal }) => fetchClientQuestionnaire(linkPublicId ?? '', responsePublicId, signal),
    enabled: linkPublicId !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** The answers typed so far; they live in memory only and are gone when the flow closes. */
export function useQuestionnaireFill(data: ClientQuestionnaire) {
  const steps = useMemo(() => buildSteps(data.questions ?? []), [data.questions]);
  const [drafts, setDrafts] = useState<Drafts>(() => prefillDrafts(steps, data.existingAnswers));
  const [touched, setTouched] = useState(false);

  const setDraft = useCallback((questionId: string, patch: Partial<Draft>) => {
    setTouched(true);
    setDrafts((current) => ({
      ...current,
      [questionId]: { ...(current[questionId] ?? EMPTY_DRAFT), ...patch },
    }));
  }, []);

  return { steps, drafts, setDraft, touched };
}
