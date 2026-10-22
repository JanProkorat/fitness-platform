import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classifyAvatarError, removeAvatar, uploadAvatar } from '@/api/avatar';
import type { AvatarFailure } from '@/api/avatar';
import { PROFILE_QUERY_KEY } from '@/api/profile';
import { pickAvatar } from '@/components/profile/edit/pickAvatar';

/**
 * Photo actions of the Edit profile screen. They apply at once and are not part of the form's
 * unsaved changes: each one refreshes `['me']` so the new photo shows everywhere.
 */
export function useAvatarActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });

  const change = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const asset = await pickAvatar();
      if (!asset) return false;
      await uploadAvatar(asset);
      return true;
    },
    onSuccess: (changed) => (changed ? refresh() : undefined),
  });

  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: refresh,
  });

  const error = change.isError ? change.error : remove.isError ? remove.error : null;
  const failure: AvatarFailure | null = error ? classifyAvatarError(error) : null;

  return {
    isPending: change.isPending || remove.isPending,
    failure,
    change: () => {
      remove.reset();
      change.mutate();
    },
    remove: () => {
      change.reset();
      remove.mutate();
    },
  };
}
