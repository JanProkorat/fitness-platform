import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import { PHOTOS_QUERY_KEY, uploadProgressPhoto } from '@/api/photos';

/** Uploads one picked photo; the list and the Profile photo count refresh once it is saved. */
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadProgressPhoto,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PHOTOS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
    },
  });
}
