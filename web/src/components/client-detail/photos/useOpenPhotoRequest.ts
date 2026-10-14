import { useQuery } from '@tanstack/react-query';
import { listDiaryRequests } from '@/api/diary-requests';
import {
  OPEN_REQUEST_PAGE_SIZE,
  findOpenRequest,
} from '@/components/client-detail/photos/photoRequestModel';

/** Query-key prefix shared by the open-request lookup and the mutations that invalidate it. */
export function photoRequestsKey(clientId: string) {
  return ['photo-diary-requests', clientId] as const;
}

/** The client's open photo request (null when there is none). */
export function useOpenPhotoRequest(clientId: string) {
  return useQuery({
    queryKey: [...photoRequestsKey(clientId), 'open'],
    queryFn: async () => {
      const items = await listDiaryRequests({ clientId, page: 1, pageSize: OPEN_REQUEST_PAGE_SIZE });
      return findOpenRequest(items) ?? null;
    },
    enabled: Boolean(clientId),
  });
}
