import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorStatus, isNetworkError } from '@/api/errors';
import { COLLABORATIONS_QUERY_KEY } from '@/api/collaborations';
import { CONVERSATIONS_QUERY_KEY, CONVERSATION_MESSAGES_QUERY_KEY } from '@/api/conversations';
import { INVITES_QUERY_KEY, acceptInvite, declineInvite } from '@/api/invites';
import { NOTIFICATIONS_QUERY_KEY } from '@/api/notifications';
import { PROFILE_QUERY_KEY, PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';

type Answer = 'accept' | 'decline';

type Variables = { id: string; answer: Answer };

type Options = {
  /** Called once the invite is settled for good: answered, expired or gone. */
  onSettled?: () => void;
};

/** Accept and decline for invitations, with the expired and no-longer-available outcomes handled. */
export function useInviteActions({ onSettled }: Options = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const refreshInvites = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    // The request conversation carries the accepted/declined state, and no push reaches the client.
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    // The invite card in the chat thread shows the answered state.
    void queryClient.invalidateQueries({ queryKey: CONVERSATION_MESSAGES_QUERY_KEY });
  }, [queryClient]);

  const tell = useCallback(
    (kind: 'expired' | 'unavailable' | 'network' | 'generic', leave: boolean) => {
      Alert.alert(t(`invites.errors.${kind}.title`), t(`invites.errors.${kind}.body`), [
        { text: t('invites.errors.ok'), onPress: leave ? onSettled : undefined },
      ]);
    },
    [onSettled, t],
  );

  const mutation = useMutation({
    mutationFn: ({ id, answer }: Variables) => (answer === 'accept' ? acceptInvite(id) : declineInvite(id)),
    onSuccess: (_data, { answer }) => {
      refreshInvites();
      // Accepting links a coach, which changes what Today and Profile show.
      if (answer === 'accept') {
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: COLLABORATIONS_QUERY_KEY });
      }
      onSettled?.();
    },
    onError: (error, { answer }) => {
      const status = getErrorStatus(error);
      if (status === 409 && answer === 'accept') {
        refreshInvites();
        tell('expired', true);
      } else if (status === 404 || status === 409) {
        refreshInvites();
        tell('unavailable', true);
      } else if (isNetworkError(error)) {
        tell('network', false);
      } else {
        tell('generic', false);
      }
    },
  });

  const accept = useCallback((id: string) => mutation.mutate({ id, answer: 'accept' }), [mutation]);
  const decline = useCallback((id: string) => mutation.mutate({ id, answer: 'decline' }), [mutation]);

  return {
    accept,
    decline,
    /** Id of the invite being answered right now, if any. */
    pendingId: mutation.isPending ? mutation.variables.id : null,
  };
}
