import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WeekStatus as ApiWeekStatus, type GetPlanResponse, type UpdatePlanRequest } from '@/api/generated';
import { publishPlanWeekFromEditor, savePlanFromEditor } from '@/api/plans';
import type { PlanEditorPrimaryAction, PlanEditorSaveState } from '@/components/plan-editor/PlanEditor';
import {
  nullToUndefined,
  toEditorTargets,
  toEditorWeeks,
  toGlobalSettings,
  toRequestWeeks,
} from '@/components/plan-editor/plan-editor-mapping';
import { weekHasItems } from '@/components/plan-editor/plan-editor-ops';
import { DAYS_PER_WEEK, type EditorDocument, type WeekStatus } from '@/components/plan-editor/plan-editor-types';
import { getApiErrorMessage, getErrorStatus } from '@/lib/api-errors';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Maps the stored plan to the editor's neutral document. Week status stays with the host. */
export function toPlanEditorDocument(plan: GetPlanResponse): EditorDocument {
  return {
    name: plan.name ?? '',
    targets: toEditorTargets(plan.globalSettings),
    weeks: toEditorWeeks(plan.weeks),
  };
}

/**
 * The PUT replaces the whole plan: name, targets and weeks come from the editor document; the start date
 * and supplements are echoed back from the loaded copy. Goal and target weight are left out, which the
 * server reads as "keep what is stored".
 */
export function toPlanUpdateRequest(
  loaded: GetPlanResponse,
  doc: EditorDocument,
  version: number | undefined,
): UpdatePlanRequest {
  return {
    name: doc.name.trim(),
    globalSettings: toGlobalSettings(doc.targets),
    weeks: toRequestWeeks(doc.weeks),
    startDate: nullToUndefined(loaded.startDate),
    supplements: (loaded.supplements ?? []).map((supplement) => ({
      externalId: supplement.externalId,
      name: supplement.name,
      dose: nullToUndefined(supplement.dose),
      notes: nullToUndefined(supplement.notes),
    })),
    version,
  };
}

/** Week number -> publication state, read from a plan response. */
function weekStatusMap(plan: GetPlanResponse): Record<number, WeekStatus> {
  const map: Record<number, WeekStatus> = {};
  (plan.weeks ?? []).forEach((week, index) => {
    map[week.weekNumber ?? index + 1] = week.status === ApiWeekStatus.Published ? 'published' : 'draft';
  });
  return map;
}

/** Midnight UTC of the plan's Monday plus whole weeks; null when the plan has no start date. */
function weekStartUtc(startDate: string | undefined, weekIndex: number): number | null {
  if (!startDate) {
    return null;
  }
  const [year, month, day] = startDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return Date.UTC(year, month - 1, day) + weekIndex * DAYS_PER_WEEK * DAY_MS;
}

function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function sameDocument(left: EditorDocument, right: EditorDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Completed and Archived plans are history: opening them read-only keeps a save from reviving them. */
export function isClosedPlan(plan: GetPlanResponse): boolean {
  const status = plan.status?.toLowerCase();
  return status === 'completed' || status === 'archived';
}

/**
 * Host logic for editing a client's plan: the initial document, save, "Publish week N", the week status
 * map and the conflict state. The loaded copy is captured once, so a background refetch never changes the
 * version the next save is checked against; every save and publish response replaces it.
 */
export function useClientPlanEditor(loadedPlan: GetPlanResponse, clientId: string) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const planId = loadedPlan.planId ?? '';
  const [initial] = useState(() => toPlanEditorDocument(loadedPlan));
  const [plan, setPlan] = useState(loadedPlan);
  const planRef = useRef(loadedPlan);
  const lastSavedRef = useRef(initial);
  const [saveState, setSaveState] = useState<PlanEditorSaveState>({ status: 'idle' });

  const saveMutation = useMutation({
    mutationFn: (request: UpdatePlanRequest) => savePlanFromEditor(planId, request),
  });
  const publishMutation = useMutation({
    mutationFn: (args: { weekNumber: number; version: number | undefined }) =>
      publishPlanWeekFromEditor(planId, args.weekNumber, args.version),
  });

  /** Takes a server response as the new baseline: version, week statuses and the saved document. */
  function adopt(response: GetPlanResponse): EditorDocument {
    const document = toPlanEditorDocument(response);
    planRef.current = response;
    lastSavedRef.current = document;
    setPlan(response);
    void queryClient.invalidateQueries({ queryKey: ['nutrition-plan-detail', planId] });
    void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
    void queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
    return document;
  }

  function fail(error: unknown) {
    if (getErrorStatus(error) === 409) {
      setSaveState({ status: 'conflict', message: t('planEditor.conflict.message') });
    } else {
      setSaveState({ status: 'error', message: getApiErrorMessage(error, 'planEditor.saveError') });
    }
  }

  async function save(doc: EditorDocument): Promise<EditorDocument | null> {
    setSaveState({ status: 'saving' });
    try {
      const saved = await saveMutation.mutateAsync(toPlanUpdateRequest(planRef.current, doc, planRef.current.version));
      setSaveState({ status: 'idle' });
      return adopt(saved);
    } catch (error) {
      fail(error);
      return null;
    }
  }

  /** Saves the document when it has unsaved changes, then publishes the selected week. */
  async function publishWeek(doc: EditorDocument, weekIndex: number): Promise<EditorDocument | null> {
    const weekNumber = doc.weeks[weekIndex]?.weekNumber;
    if (weekNumber === undefined) {
      return null;
    }
    setSaveState({ status: 'saving' });
    try {
      if (!sameDocument(doc, lastSavedRef.current)) {
        const saved = await saveMutation.mutateAsync(toPlanUpdateRequest(planRef.current, doc, planRef.current.version));
        adopt(saved);
      }
      const published = await publishMutation.mutateAsync({ weekNumber, version: planRef.current.version });
      setSaveState({ status: 'idle' });
      return adopt(published);
    } catch (error) {
      fail(error);
      return null;
    }
  }

  const statuses = weekStatusMap(plan);
  const publishedCount = Object.values(statuses).filter((status) => status === 'published').length;
  const totalWeeks = plan.weeks?.length ?? 0;

  /** Why a week cannot be published right now, or null when it can. */
  function publishBlocker(weekIndex: number, doc: EditorDocument): 'published' | 'empty' | 'noStart' | 'past' | null {
    const week = doc.weeks[weekIndex];
    if (!week || statuses[week.weekNumber] === 'published') {
      return 'published';
    }
    if (!weekHasItems(week)) {
      return 'empty';
    }
    const start = weekStartUtc(plan.startDate, weekIndex);
    if (start === null) {
      return 'noStart';
    }
    return start < todayUtc() ? 'past' : null;
  }

  const primaryAction: PlanEditorPrimaryAction = {
    label: (weekNumber) => t('clientPlanEditor.publishWeek', { week: weekNumber }),
    run: publishWeek,
    disabled: (weekIndex, doc) => publishBlocker(weekIndex, doc) !== null,
    title: (weekIndex, doc) => {
      const blocker = publishBlocker(weekIndex, doc);
      if (blocker === 'noStart') {
        return t('apiErrors.START_DATE_REQUIRED');
      }
      return blocker === 'past' ? t('apiErrors.WEEK_START_IN_PAST') : undefined;
    },
  };

  /** A week that is not stored yet counts as a draft. */
  function weekStatus(weekIndex: number): WeekStatus {
    return statuses[weekIndex + 1] ?? 'draft';
  }

  /** The week's Monday, e.g. "6 Oct"; nothing when the plan has no start date. */
  function weekSubLabel(weekIndex: number): string | undefined {
    const start = weekStartUtc(plan.startDate, weekIndex);
    if (start === null) {
      return undefined;
    }
    return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(start);
  }

  return {
    initial,
    saveState,
    save,
    primaryAction,
    weekStatus,
    weekSubLabel,
    publishedCount,
    totalWeeks,
  };
}
