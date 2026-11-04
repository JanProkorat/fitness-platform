import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { COLLABORATIONS_QUERY_KEY } from '@/api/collaborations';
import {
  MY_REQUESTS_KEY,
  acceptRequestProposal,
  classifyProposalError,
  declineRequestProposal,
} from '@/api/clientRequests';
import type { ProposalFailure } from '@/api/clientRequests';
import { CONVERSATIONS_QUERY_KEY, CONVERSATION_MESSAGES_QUERY_KEY } from '@/api/conversations';
import { NOTIFICATIONS_QUERY_KEY } from '@/api/notifications';
import { PAYMENTS_QUERY_KEY } from '@/api/payments';
import { PLANS_QUERY_KEY } from '@/api/plans';
import { PROFILE_QUERY_KEY, PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import { PENDING_QUESTIONNAIRES_QUERY_KEY, SUBMITTED_QUESTIONNAIRES_QUERY_KEY } from '@/api/questionnaires';

type Answer = 'accept' | 'decline';

type Variables = { id: string; answer: Answer };

type Options = {
  /** Called once the proposal is answered for good: accepted or declined. */
  onSettled?: () => void;
};

/** Failures after which the request is no longer open, so the screen shows "no open proposal". */
const REFETCH_FAILURES: readonly ProposalFailure[] = ['notFound', 'invalidState', 'coachRoleRemoved'];

/** Accept and decline for a coach's package proposal; nothing changes on screen until the server answers. */
export function useRequestProposal({ onSettled }: Options = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const refreshRequests = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    // The request conversation carries the proposal state, and no push reaches the client for it.
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONVERSATION_MESSAGES_QUERY_KEY });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: ({ id, answer }: Variables) =>
      answer === 'accept' ? acceptRequestProposal(id) : declineRequestProposal(id),
    onSuccess: (_data, { answer }) => {
      refreshRequests();
      // Accepting links a coach, which changes everything a new coach link affects.
      if (answer === 'accept') {
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: COLLABORATIONS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ['nutrition'] });
        void queryClient.invalidateQueries({ queryKey: PENDING_QUESTIONNAIRES_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: SUBMITTED_QUESTIONNAIRES_QUERY_KEY });
      }
      onSettled?.();
    },
    onError: (error) => {
      const failure = classifyProposalError(error);
      if (REFETCH_FAILURES.includes(failure)) refreshRequests();
      Alert.alert(t(`requestProposal.errors.${failure}.title`), t(`requestProposal.errors.${failure}.body`), [
        { text: t('requestProposal.errors.ok') },
      ]);
    },
  });

  const accept = useCallback((id: string) => mutation.mutate({ id, answer: 'accept' }), [mutation]);
  const decline = useCallback((id: string) => mutation.mutate({ id, answer: 'decline' }), [mutation]);

  return { accept, decline, busy: mutation.isPending };
}
