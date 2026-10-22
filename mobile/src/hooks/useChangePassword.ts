import { useMutation } from '@tanstack/react-query';

import { changePassword, classifyChangePasswordError } from '@/api/settings';
import { useAuthStore } from '@/stores/auth';

/** Changes the password and keeps the session alive with the token pair the server returns. */
export function useChangePassword() {
  const mutation = useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const { sessionGeneration } = useAuthStore.getState();
      const tokens = await changePassword(input);
      // The old refresh token is revoked; without the new pair the next refresh would log the user out.
      await useAuthStore
        .getState()
        .applyRefreshedTokens(sessionGeneration, tokens.accessToken, tokens.refreshToken);
    },
  });

  return {
    submit: mutation.mutate,
    reset: mutation.reset,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    failure: mutation.isError ? classifyChangePasswordError(mutation.error) : null,
  };
}
