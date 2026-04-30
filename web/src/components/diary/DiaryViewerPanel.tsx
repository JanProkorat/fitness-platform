/**
 * DiaryViewerPanel — panel shown in the Photos tab of a plan detail page.
 *
 * Lists all photo diary requests scoped to this plan (by planId).
 * For each request, renders a DiaryRequestCard with status chip and
 * day-grouped photo gallery.
 *
 * Query key: ['diary-requests', planId]
 * Invalidated by SignalR events (see AppShell.tsx):
 *   photoDiaryRequested, photoDiaryDismissed, photoDiarySubmitted →
 *     invalidate ['diary-requests', planId]
 *   photoDiaryPhotoUploaded → invalidate ['planPhotos', clientId, planId]
 *     (already handled by AppShell, propagates through allPhotos prop)
 *
 * Design-of-record:
 *   docs/prototypes/trainer/scenes/nutrition-plan-detail.html (Photos tab —
 *     "Foto-deník" section above the regular photo grid)
 *   docs/prototypes/notion/scenes/nutrition.html (Foto-deník sidebar panel)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listDiaryRequests } from '@/api/diary-requests';
import { DiaryRequestCard } from './DiaryRequestCard';
import type { PlanPhotoResponse2 } from '@/api/generated';

interface Props {
  planId: string;
  /** All plan photos already loaded by PlanPhotosTab. Passed through to cards
   *  so we don't fire a second request. */
  allPhotos: PlanPhotoResponse2[];
}

export function DiaryViewerPanel({ planId, allPhotos }: Props) {
  const { t } = useTranslation();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['diary-requests', planId],
    queryFn: () => listDiaryRequests({ planId }),
    enabled: !!planId,
    staleTime: 30_000,
  });

  // Sort by createdAt descending — newest request first regardless of status.
  // ISO-8601 timestamps sort lexicographically the same way they sort
  // chronologically, so a string compare is enough here.
  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      ),
    [requests],
  );

  if (!isLoading && sortedRequests.length === 0) {
    return null; // Nothing to show — drop entirely so the surrounding layout doesn't reserve space.
  }

  // Full list — used by the Diaries tab. The tab chip already labels the
  // section, so we don't repeat a "Foto deník" header row here.
  return (
    <div className="shrink-0 px-4 pt-4 pb-3">
      {isLoading && (
        <div className="text-[12px] text-text3 py-2">
          {t('common.loading')}
        </div>
      )}

      {!isLoading && sortedRequests.length > 0 && (
        <div className="flex flex-col gap-2">
          {sortedRequests.map((request) => (
            <DiaryRequestCard
              key={request.id}
              request={request}
              allPhotos={allPhotos}
            />
          ))}
        </div>
      )}
    </div>
  );
}
