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

  // Sort: active (InProgress) first, then Accepted, Pending, Completed, Dismissed
  const sortedRequests = useMemo(() => {
    const ORDER: Record<string, number> = {
      InProgress: 0,
      Accepted: 1,
      Pending: 2,
      Completed: 3,
      Dismissed: 4,
    };
    return [...requests].sort((a, b) => {
      const aO = ORDER[a.status ?? ''] ?? 5;
      const bO = ORDER[b.status ?? ''] ?? 5;
      if (aO !== bO) return aO - bO;
      // Secondary: newest first
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [requests]);

  if (!isLoading && sortedRequests.length === 0) {
    return null; // No diary requests for this plan — don't show the panel
  }

  return (
    <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text3">
          {t('diary.viewer.sectionTitle')}
        </span>
        {!isLoading && sortedRequests.length > 0 && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums"
            style={{ background: 'var(--bg3)', color: 'var(--text3)' }}
          >
            {sortedRequests.length}
          </span>
        )}
      </div>

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
