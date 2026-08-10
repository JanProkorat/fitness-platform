/**
 * FotkyTab — Photo-diary overview pane for the client detail page.
 *
 * Shows the most recent 8 photos across all plans as a thumbnail grid,
 * a category + plan chip filter bar (client-side), a diary-request CTA,
 * and a "Otevřít galerii" link that navigates to the active nutrition
 * plan's photos tab.  If no active nutrition plan exists the gallery CTA
 * is disabled and the +N overflow tile is hidden.
 *
 * Data sources (do not modify):
 *   - getClientPhotoGroups  (web/src/api/client-photos.ts)
 *   - listDiaryRequests     (web/src/api/diary-requests.ts)
 * Dialog:
 *   - RequestDiaryDialog    (web/src/components/diary/RequestDiaryDialog.tsx)
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { apiClient } from '@/api/client';
import { PlanPhotoCategory, PlanPhotoType } from '@/api/generated';
import type { ClientPhotoResponse } from '@/api/client-photos';
import {
  listDiaryRequests,
  linkPhotoDiaryToPlan,
  type PhotoDiaryRequestSummary,
} from '@/api/diary-requests';
import { RequestDiaryDialog } from '@/components/diary/RequestDiaryDialog';
import { DiaryRequestStatusChip } from '@/components/diary/DiaryRequestStatusChip';
import { LinkDiaryToPlanDialog, type DiaryPlanOption } from '@/components/diary/LinkDiaryToPlanDialog';
import { getPlans } from '@/api/plans';
import { getTrainingPlans } from '@/api/training-plans';
import type { PlanSummary } from '@/api/plan-types';
import type { TrainingPlanSummary } from '@/api/training-plan-types';
import { formatClientDate } from '@/lib/date-format';
import { EmptyState } from '@/components/clients/EmptyState';
import { useAuthStore } from '@/stores/auth';
import { showApiError, showSuccess } from '@/lib/api-errors';

// How many thumbnails to show before the overflow tile.
const MAX_VISIBLE = 8;

// ── Category emoji map ────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<PlanPhotoCategory, string> = {
  [PlanPhotoCategory.Food]: '🍽️',
  [PlanPhotoCategory.Body]: '📏',
  [PlanPhotoCategory.FreeForm]: '📷',
  [PlanPhotoCategory.Training]: '🏋️',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FotkyTabProps {
  clientId: string;
  /** Resolved display name for the client (used in the diary dialog). */
  clientName: string;
  /** Resolved initials for the client avatar in the diary dialog. */
  clientInitials: string;
  /**
   * Internal integer PK of ClientProfessionalLink — passed directly to
   * RequestDiaryDialog (same as PlanPhotosTab pattern).
   */
  linkId?: number | null;
  /**
   * Active nutrition plan summary fetched by ClientDetailPage.
   * Used for the "Otevřít galerii" CTA and plan chips.
   */
  activeNutritionPlan?: PlanSummary | null;
  /**
   * Active training plan summary fetched by ClientDetailPage.
   * Used for plan chips.
   */
  activeTrainingPlan?: TrainingPlanSummary | null;
}

// ── Filter chip type ──────────────────────────────────────────────────────────

type PhotoFilter =
  | 'all'
  | PlanPhotoCategory.Food
  | PlanPhotoCategory.Body
  | string; // planId chip

// ── Component ─────────────────────────────────────────────────────────────────

export function FotkyTab({
  clientId,
  clientName,
  clientInitials,
  linkId,
  activeNutritionPlan,
  activeTrainingPlan,
}: FotkyTabProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [activeFilter, setActiveFilter] = useState<PhotoFilter>('all');
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  // Diary request currently targeted by the "link to plan" dialog (#778 AC5).
  const [linkDialogRequest, setLinkDialogRequest] = useState<PhotoDiaryRequestSummary | null>(null);

  // ── Photo query (flat, most recent 50) ──────────────────────────────────────
  // We call the underlying apiClient directly with groupByMonth=false so we get
  // a flat array.  Types are imported from client-photos.ts (not generated.ts).
  const { data: photoData, isPending: photosLoading, isError: photosError } = useQuery({
    queryKey: ['client-photos-flat', clientId],
    queryFn: () =>
      apiClient.getTrainerClientPhotosEndpoint(
        clientId,
        1,   // page
        50,  // pageSize
        false, // groupByMonth — flat list
      ),
    enabled: Boolean(clientId),
    retry: false,
    staleTime: 30_000,
  });

  // `GetTrainerClientPhotosResponse.photos` holds the flat array when
  // groupByMonth=false is passed.
  const allPhotos: ClientPhotoResponse[] = useMemo(
    () => photoData?.photos ?? [],
    [photoData],
  );

  // ── Diary requests query ─────────────────────────────────────────────────────
  // Mirror the PlanPhotosTab.hasInFlightDiary guard: fetch all requests for
  // this link (no planId filter) and check for in-flight statuses.
  //
  // Key is a plain string segment (['diary-requests', clientId]) — NOT an
  // object segment — so AppShell's photodiary* SignalR handlers (which
  // invalidate the bare ['diary-requests'] prefix as their fallback branch)
  // structurally match via TanStack Query's prefix-match invalidation (#614).
  //
  // `enabled` requires linkId to be resolved (not just clientId) before
  // fetching: passing `linkId: undefined` to listDiaryRequests() drops the
  // backend's linkId filter entirely and returns every diary request across
  // ALL of the trainer's clients — a cross-client data leak (#647).
  const { data: diaryRequests = [] } = useQuery({
    queryKey: ['diary-requests', clientId],
    queryFn: () => listDiaryRequests({ linkId: linkId ?? undefined }),
    enabled: Boolean(clientId) && linkId != null,
    staleTime: 30_000,
  });

  const hasInFlightDiary = diaryRequests.some(
    (r) => r.status === 'Pending' || r.status === 'Accepted' || r.status === 'InProgress',
  );

  const hasActiveDiary = hasInFlightDiary;

  // Sort diary requests newest-first, matching DiaryViewerPanel's convention
  // (#778 AC4 — already satisfied server-side; kept consistent here too).
  const sortedDiaryRequests = useMemo(
    () => [...diaryRequests].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [diaryRequests],
  );

  // ── All client plans (not just active) — resolves click-through targets ─────
  // Mirrors DotaznikyTab's linkedPlanByResponseId pattern (#777): fetch the
  // client's full nutrition + training plan lists (role-gated, since both
  // list endpoints 403 for the wrong role) so a photo/diary linked to a
  // historical (non-active) plan still resolves a name + click-through
  // target, not just the currently active plan (#778 AC3/AC5).
  const isNutritionist = user?.roles.some((r) => ['Nutritionist', 'Admin'].includes(r)) ?? false;
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Admin'].includes(r)) ?? false;

  const nutritionPlansQuery = useQuery({
    queryKey: ['plans', { clientId, all: true }],
    queryFn: () => getPlans({ clientId, pageSize: 100 }),
    enabled: Boolean(clientId) && isNutritionist,
  });
  const trainingPlansQuery = useQuery({
    queryKey: ['training-plans', { clientId, all: true }],
    queryFn: () => getTrainingPlans({ clientId, pageSize: 100 }),
    enabled: Boolean(clientId) && isTrainer,
  });

  const allPlanOptions: DiaryPlanOption[] = useMemo(() => {
    const opts: DiaryPlanOption[] = [];
    for (const p of nutritionPlansQuery.data?.plans ?? []) {
      opts.push({ planId: p.planId, name: p.name, kind: 'nutrition' });
    }
    for (const p of trainingPlansQuery.data?.plans ?? []) {
      opts.push({ planId: p.planId, name: p.name, kind: 'training' });
    }
    return opts;
  }, [nutritionPlansQuery.data, trainingPlansQuery.data]);

  const planById = useMemo(() => {
    const map = new Map<string, DiaryPlanOption>();
    for (const opt of allPlanOptions) map.set(opt.planId, opt);
    return map;
  }, [allPlanOptions]);

  // diaryRequestId -> planId, used to resolve a photo's linked plan when the
  // photo itself has no planId/planType set — e.g. photos uploaded before
  // the diary was retroactively linked (#778 AC5) still show a click-through
  // once the diary gains a plan, since PlanPhoto rows aren't backfilled.
  const diaryPlanIdByRequestId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of diaryRequests) {
      if (r.id && r.planId) map.set(r.id, r.planId);
    }
    return map;
  }, [diaryRequests]);

  function resolvePhotoLinkedPlan(photo: ClientPhotoResponse): DiaryPlanOption | undefined {
    if (photo.planId) {
      const direct = planById.get(photo.planId);
      if (direct) return direct;
      // Fall back to the photo's own planType if the plan isn't in our
      // (role-gated) list — still enough to build a navigable link.
      if (photo.planType) {
        return {
          planId: photo.planId,
          name: '',
          kind: photo.planType === PlanPhotoType.Training ? 'training' : 'nutrition',
        };
      }
    }
    const viaDiaryPlanId = photo.diaryRequestId ? diaryPlanIdByRequestId.get(photo.diaryRequestId) : undefined;
    return viaDiaryPlanId ? planById.get(viaDiaryPlanId) : undefined;
  }

  function navigateToPlan(plan: DiaryPlanOption) {
    navigate(
      plan.kind === 'nutrition'
        ? `/clients/${clientId}/plans/${plan.planId}`
        : `/clients/${clientId}/training-plans/${plan.planId}`,
    );
  }

  // ── Retroactive diary→plan linking (#778 AC5) ────────────────────────────────
  const linkMutation = useMutation({
    mutationFn: ({ requestId, planId }: { requestId: string; planId: string }) =>
      linkPhotoDiaryToPlan(requestId, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary-requests', clientId] });
      setLinkDialogRequest(null);
      showSuccess('clientDetail.fotky.linkSuccess');
    },
    onError: (err) => {
      // Keep the dialog open on failure so the trainer can retry (404 diary
      // not found / plan not owned, 403 forbidden, 400 validation).
      showApiError(err, 'clientDetail.fotky.linkError');
    },
  });

  // ── Plan chips — derived from active plan summaries ──────────────────────────
  // Photos carry a planId (Mongo external id) that we match against active plan
  // summaries passed in by ClientDetailPage.  Only plans that actually have at
  // least one photo get a chip.  Photos with no matching plan fall under "Vše".

  interface PlanChip {
    planId: string;
    name: string;
    count: number;
  }

  const planChips: PlanChip[] = useMemo(() => {
    const planMap = new Map<string, string>();
    if (activeNutritionPlan?.planId) {
      planMap.set(activeNutritionPlan.planId, activeNutritionPlan.name);
    }
    if (activeTrainingPlan?.planId) {
      planMap.set(activeTrainingPlan.planId, activeTrainingPlan.name);
    }

    // Count photos per planId
    const countMap = new Map<string, number>();
    for (const p of allPhotos) {
      if (p.planId) {
        countMap.set(p.planId, (countMap.get(p.planId) ?? 0) + 1);
      }
    }

    // Only emit chips for plans that appear in both the summary map AND photos
    const chips: PlanChip[] = [];
    for (const [pid, name] of planMap.entries()) {
      const cnt = countMap.get(pid) ?? 0;
      if (cnt > 0) {
        chips.push({ planId: pid, name, count: cnt });
      }
    }
    return chips;
  }, [allPhotos, activeNutritionPlan, activeTrainingPlan]);

  // ── Filter categories (Food / Body — no FreeForm chip per spec) ──────────────
  const CATEGORY_CHIPS: Array<{ key: PlanPhotoCategory.Food | PlanPhotoCategory.Body; labelKey: string }> = [
    { key: PlanPhotoCategory.Food, labelKey: 'clientDetail.fotky.categoryFood' },
    { key: PlanPhotoCategory.Body, labelKey: 'clientDetail.fotky.categoryBody' },
  ];

  // ── Derived counts ────────────────────────────────────────────────────────────
  const totalCount = allPhotos.length;

  // Distinct plan ids among returned photos
  const planCount = useMemo(
    () => new Set(allPhotos.map((p) => p.planId).filter(Boolean)).size,
    [allPhotos],
  );

  // Per-category counts for chips
  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of allPhotos) {
      if (p.category != null) c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [allPhotos]);

  // ── Client-side filtered photos ───────────────────────────────────────────────
  const filteredPhotos: ClientPhotoResponse[] = useMemo(() => {
    if (activeFilter === 'all') return allPhotos;
    if (
      activeFilter === PlanPhotoCategory.Food ||
      activeFilter === PlanPhotoCategory.Body
    ) {
      return allPhotos.filter((p) => p.category === activeFilter);
    }
    // Plan-id chip
    return allPhotos.filter((p) => p.planId === activeFilter);
  }, [allPhotos, activeFilter]);

  // Show the most recent MAX_VISIBLE, then a +N overflow tile if more exist
  const visiblePhotos = filteredPhotos.slice(0, MAX_VISIBLE);
  const overflowCount = Math.max(0, filteredPhotos.length - MAX_VISIBLE);

  // ── Gallery navigation ────────────────────────────────────────────────────────
  // Navigate to the active nutrition plan page (/clients/:id/plans/:planId).
  // If no active plan exists the CTA is disabled and overflow tile is hidden.
  const galleryTarget = activeNutritionPlan
    ? `/clients/${clientId}/plans/${activeNutritionPlan.planId}`
    : null;

  function handleOpenGallery() {
    if (galleryTarget) navigate(galleryTarget);
  }

  // ── Date formatter (active locale, matching MereniTab / PlanPhotosTab pattern) ─
  function formatDate(iso: string | undefined): string {
    return formatClientDate(iso, i18n.language, 'numeric', '—');
  }

  // ── Category label for thumbnail caption ─────────────────────────────────────
  function categoryLabel(cat: PlanPhotoCategory | undefined): string {
    switch (cat) {
      case PlanPhotoCategory.Food:
        return t('clientDetail.fotky.categoryFood');
      case PlanPhotoCategory.Body:
        return t('clientDetail.fotky.categoryBody');
      default:
        return '';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div id="cl-pane-fotky">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-semibold text-text">
            {t('clientDetail.fotky.title')}
          </div>
          {totalCount > 0 && (
            <div className="text-[12px] text-text3">
              {t('clientDetail.fotky.countBadge', {
                photos: totalCount,
                plans: planCount,
              })}
            </div>
          )}
          {hasActiveDiary && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
              style={{
                background: 'var(--green-bg)',
                borderColor: 'var(--green-br)',
                color: 'var(--green)',
              }}
            >
              <span>●</span>
              {t('clientDetail.fotky.activeDiary')}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={hasInFlightDiary}
            onClick={() => setDiaryDialogOpen(true)}
            className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              hasInFlightDiary
                ? t('diary.request.alreadyPending')
                : undefined
            }
          >
            📸 {t('clientDetail.fotky.newRequest')}
          </button>
          <button
            type="button"
            disabled={!galleryTarget}
            onClick={handleOpenGallery}
            className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              !galleryTarget
                ? t('clientDetail.fotky.noActivePlanTooltip')
                : undefined
            }
          >
            🖼️ {t('clientDetail.fotky.openGallery')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {photosLoading && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('common.loading')}
        </div>
      )}

      {/* Error — non-fatal, mirror MereniTab pattern */}
      {photosError && !photosLoading && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('clientDetail.fotky.errorLoading')}
        </div>
      )}

      {/* Content — only when loaded without error */}
      {!photosLoading && !photosError && (
        <>
          {/* Filter chip bar */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {/* Vše chip */}
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
                  activeFilter === 'all'
                    ? 'bg-accent text-bg border-accent'
                    : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
                )}
              >
                {t('clientDetail.fotky.filterAll')}
                <span className="tabular-nums opacity-80">({totalCount})</span>
              </button>

              {/* Food / Body category chips (no FreeForm) */}
              {CATEGORY_CHIPS.map(({ key, labelKey }) => {
                const count = catCounts[key] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={cn(
                      'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
                      activeFilter === key
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
                    )}
                  >
                    {t(labelKey)}
                    <span className="tabular-nums opacity-80">({count})</span>
                  </button>
                );
              })}

              {/* One chip per active/recent plan that has photos */}
              {planChips.map(({ planId, name, count }) => (
                <button
                  key={planId}
                  type="button"
                  onClick={() => setActiveFilter(planId)}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
                    activeFilter === planId
                      ? 'bg-accent text-bg border-accent'
                      : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
                  )}
                >
                  {name}
                  <span className="tabular-nums opacity-80">({count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {totalCount === 0 && (
            <EmptyState
              icon="📷"
              title={t('clientDetail.fotky.emptyTitle')}
              description={t('clientDetail.fotky.emptyDescription')}
              action={
                <button
                  type="button"
                  disabled={hasInFlightDiary}
                  onClick={() => setDiaryDialogOpen(true)}
                  className="mt-1 text-[13px] font-semibold hover:underline bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: 'var(--accent)' }}
                >
                  📸 {t('clientDetail.fotky.emptyRequestCta')}
                </button>
              }
            />
          )}

          {/* Thumbnail grid — auto-fill min 140px columns, 1:1 aspect */}
          {totalCount > 0 && (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              {visiblePhotos.map((photo, idx) => {
                const dateIso = photo.takenAt ?? photo.uploadedAt;
                const emoji = photo.category ? CATEGORY_EMOJI[photo.category] : '📷';
                const catLbl = categoryLabel(photo.category);
                const linkedPlan = resolvePhotoLinkedPlan(photo);
                return (
                  <div
                    key={photo.id ?? idx}
                    className="flex flex-col overflow-hidden border border-border rounded-[var(--radius-md)] bg-bg2"
                  >
                    {/* Thumbnail — 1:1 aspect */}
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: '1 / 1' }}
                    >
                      {photo.blobUrl ? (
                        <img
                          src={photo.blobUrl}
                          alt={photo.description ?? `${t('clientDetail.fotky.photoAlt')} ${idx + 1}`}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[32px] opacity-50">
                          {emoji}
                        </div>
                      )}
                      {/* Click-through to the photo's linked plan (#778 AC3) */}
                      {linkedPlan && (
                        <button
                          type="button"
                          onClick={() => navigateToPlan(linkedPlan)}
                          className="absolute bottom-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] bg-bg/90 border border-border hover:bg-accent hover:text-bg transition-colors"
                          title={t('clientDetail.fotky.linkedPlanCta', { name: linkedPlan.name || t(linkedPlan.kind === 'nutrition' ? 'sidebar.mealPlan' : 'sidebar.trainingPlan') })}
                          aria-label={t('clientDetail.fotky.linkedPlanCta', { name: linkedPlan.name || t(linkedPlan.kind === 'nutrition' ? 'sidebar.mealPlan' : 'sidebar.trainingPlan') })}
                        >
                          🔗
                        </button>
                      )}
                    </div>
                    {/* Date + type caption */}
                    <div className="px-2 py-1.5">
                      <div className="text-[11px] text-text3 tabular-nums">
                        {formatDate(dateIso)}
                      </div>
                      {catLbl && (
                        <div className="text-[10px] text-text3 mt-0.5 truncate">
                          {catLbl}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* +N overflow tile — only shown when gallery navigation is possible */}
              {overflowCount > 0 && galleryTarget && (
                <button
                  type="button"
                  onClick={handleOpenGallery}
                  className="flex flex-col items-center justify-center overflow-hidden border border-border rounded-[var(--radius-md)] bg-bg2 hover:bg-bg3 transition-colors cursor-pointer"
                  style={{ aspectRatio: '1 / 1' }}
                  aria-label={t('clientDetail.fotky.overflowAriaLabel', { count: overflowCount })}
                >
                  <div className="text-[22px] font-semibold" style={{ color: 'var(--accent)' }}>
                    +{overflowCount}
                  </div>
                  <div className="text-[11px] text-text3 mt-1">
                    {t('clientDetail.fotky.overflowLabel')}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Foto-deníky — client-wide diary request list (#778 AC5). Each
              row shows status + either the linked plan CTA (click-through,
              AC3) or a "link to plan" affordance for diaries that don't
              have one yet. */}
          {sortedDiaryRequests.length > 0 && (
            <div className="mt-5">
              <div className="text-[13px] font-semibold text-text mb-2">
                {t('clientDetail.fotky.diariesTitle')}
              </div>
              <div className="flex flex-col gap-2">
                {sortedDiaryRequests.map((request) => {
                  const linkedPlan = request.planId ? planById.get(request.planId) : undefined;
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 border border-border rounded-[var(--radius-md)] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <DiaryRequestStatusChip request={request} />
                        <span className="text-[11px] text-text3 tabular-nums truncate">
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                      {linkedPlan ? (
                        <button
                          type="button"
                          onClick={() => navigateToPlan(linkedPlan)}
                          className="text-[11px] font-medium text-accent bg-transparent border-none cursor-pointer p-0 hover:underline shrink-0"
                        >
                          🔗 {t('clientDetail.fotky.linkedPlanCta', { name: linkedPlan.name })}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLinkDialogRequest(request)}
                          disabled={allPlanOptions.length === 0}
                          className="text-[11px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-2 py-1 hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          title={allPlanOptions.length === 0 ? t('clientDetail.fotky.noPlansAvailable') : undefined}
                        >
                          🔗 {t('clientDetail.fotky.linkToPlan')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Diary request dialog */}
      <RequestDiaryDialog
        open={diaryDialogOpen}
        onClose={() => setDiaryDialogOpen(false)}
        linkId={linkId}
        clientName={clientName}
        clientInitials={clientInitials}
      />

      {/* Retroactive diary→plan link dialog (#778 AC5) */}
      <LinkDiaryToPlanDialog
        open={!!linkDialogRequest}
        onClose={() => setLinkDialogRequest(null)}
        plans={allPlanOptions}
        isPending={linkMutation.isPending}
        onConfirm={(planId) => {
          if (linkDialogRequest?.id) {
            linkMutation.mutate({ requestId: linkDialogRequest.id, planId });
          }
        }}
      />
    </div>
  );
}
