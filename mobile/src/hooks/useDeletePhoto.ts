import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getErrorStatus } from '@/api/errors';
import { PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import { PHOTOS_QUERY_KEY, deletePhoto } from '@/api/photos';

const NOT_FOUND = 404;

/**
 * Deletes one of the client's own photos. A 404 means it is already gone, so the call
 * resolves and the list refreshes like a normal delete.
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      try {
        await deletePhoto(photoId);
      } catch (error) {
        if (getErrorStatus(error) !== NOT_FOUND) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PHOTOS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
    },
  });
}
