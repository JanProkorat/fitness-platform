import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  PENDING_QUESTIONNAIRES_QUERY_KEY,
  SUBMITTED_QUESTIONNAIRES_QUERY_KEY,
  classifyQuestionnaireError,
  createQuestionnaireResponse,
  saveQuestionnaireAnswers,
  submitQuestionnaireResponse,
} from '@/api/questionnaires';
import type { AnswerPayload, ClientQuestionnaire } from '@/api/questionnaires';
import { buildAnswers, countAnswered } from '@/components/questionnaire/fillModel';
import type { Drafts, FillStep } from '@/components/questionnaire/fillModel';

export type SentSummary = { count: number; at: Date };

type SendInput = { answers: AnswerPayload[]; count: number };

/**
 * Create the response (only when none exists), save every answer, then submit. A retry after a partial
 * failure reuses the response that was already created instead of making another.
 */
export function useSendQuestionnaire(
  data: ClientQuestionnaire,
  steps: readonly FillStep[],
  drafts: Drafts,
) {
  const queryClient = useQueryClient();
  const responseId = useRef<string | null>(data.existingResponsePublicId ?? null);
  // A ref, not state: a second tap can land before the pending state re-renders the button.
  const inFlight = useRef(false);
  const [sent, setSent] = useState<SentSummary | null>(null);

  const refreshLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PENDING_QUESTIONNAIRES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SUBMITTED_QUESTIONNAIRES_QUERY_KEY });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async ({ answers }: SendInput) => {
      if (responseId.current === null) {
        const questionnaireId = data.questionnairePublicId;
        if (!questionnaireId) throw new Error('The questionnaire has no id.');
        responseId.current = await createQuestionnaireResponse(questionnaireId);
      }
      await saveQuestionnaireAnswers(responseId.current, answers);
      await submitQuestionnaireResponse(responseId.current);
    },
    onSuccess: (_result, { count }) => {
      setSent({ count, at: new Date() });
      refreshLists();
    },
    onError: (error) => {
      const failure = classifyQuestionnaireError(error);
      // The response is gone or already sent: whatever the lists show is stale.
      if (failure === 'unavailable' || failure === 'alreadySent') refreshLists();
    },
  });

  const { mutate } = mutation;
  const send = useCallback(
    (onSent: () => void) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(
        { answers: buildAnswers(steps, drafts), count: countAnswered(steps, drafts) },
        {
          onSuccess: onSent,
          onSettled: () => {
            inFlight.current = false;
          },
        },
      );
    },
    [mutate, steps, drafts],
  );

  return {
    send,
    sending: mutation.isPending,
    failure: mutation.isError ? classifyQuestionnaireError(mutation.error) : null,
    sent,
  };
}
