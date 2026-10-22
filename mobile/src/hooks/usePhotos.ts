import { useQuery } from '@tanstack/react-query';

import { PHOTOS_QUERY_KEY, PHOTOS_STALE_MS, fetchPhotoMonths } from '@/api/photos';
import { useAuthStore } from '@/stores/auth';

/** The client's progress photos by month; refetched before their signed URLs can expire. */
export function usePhotos() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PHOTOS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPhotoMonths(signal),
    enabled: isAuthenticated,
    staleTime: PHOTOS_STALE_MS,
    retry: 1,
  });
}
