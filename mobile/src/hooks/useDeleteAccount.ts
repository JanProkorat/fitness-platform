import { useMutation } from '@tanstack/react-query';

import { deleteAccount } from '@/api/settings';
import { useAuthStore } from '@/stores/auth';

/** Deletes the account, then signs out. A failure leaves the user signed in. */
export function useDeleteAccount() {
  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => useAuthStore.getState().logout(),
  });

  return {
    submit: mutation.mutate,
    reset: mutation.reset,
    isPending: mutation.isPending,
    failed: mutation.isError,
  };
}
