import type { TFunction } from 'i18next';

import { QuestionnaireResponseKind } from '@/api/generated';
import type { PendingQuestionnaire } from '@/api/questionnaires';
import { dueMoment } from '@/components/checkIns/model';
import { firstName } from '@/components/invites/format';

export type FillRoute = {
  pathname: '/questionnaire/[linkPublicId]';
  params: { linkPublicId: string; responsePublicId?: string };
};

/** The fill-flow route of a pending form; the link-level fallback item has no response id. */
export function fillRoute(item: PendingQuestionnaire): FillRoute | null {
  if (!item.linkPublicId) return null;
  return {
    pathname: '/questionnaire/[linkPublicId]',
    params: item.responsePublicId
      ? { linkPublicId: item.linkPublicId, responsePublicId: item.responsePublicId }
      : { linkPublicId: item.linkPublicId },
  };
}

/** True for a weekly check-in answered through the questionnaire flow. */
export const isCheckInForm = (item: PendingQuestionnaire): boolean => item.kind === QuestionnaireResponseKind.CheckIn;

/** The fill-flow route of the pending form with this response id, or null when it is not pending. */
export function fillRouteForResponse(
  items: readonly PendingQuestionnaire[] | undefined,
  responsePublicId: string,
): FillRoute | null {
  const match = (items ?? []).find((item) => item.responsePublicId === responsePublicId);
  return match ? fillRoute(match) : null;
}

/** "Answer by Saturday 18:00" for a check-in banner; empty when the form is no check-in or has no due time. */
export function checkInDueHint(t: TFunction, language: string, item: PendingQuestionnaire): string | undefined {
  if (!isCheckInForm(item)) return undefined;
  const when = dueMoment(language, item.checkInDueAtUtc);
  return when ? t('today.questionnaire.checkInDue', { when }) : undefined;
}

/** Pending forms the client can open, in the order the server sent them (oldest first). */
export const fillableForms = (items: readonly PendingQuestionnaire[] | undefined): PendingQuestionnaire[] =>
  (items ?? []).filter((item) => Boolean(item.linkPublicId));

/** Question-count hint for the Today banner or the progress step; empty when no question is answerable. */
export function questionCountHint(
  t: TFunction,
  item: PendingQuestionnaire,
  kind: 'banner' | 'step',
): string | undefined {
  const count = item.questionCount ?? 0;
  if (count <= 0) return undefined;
  return t(kind === 'banner' ? 'today.questionnaire.bannerHint' : 'today.questionnaire.stepHint', { count });
}

/** "Answer Jana's questions" for the single-coach progress step; without a name, the coach is named by role. */
export function questionnaireStepTitle(t: TFunction, item: PendingQuestionnaire): string {
  const name = firstName(item.professionalName?.trim() ?? '');
  if (name) return t('today.questionnaire.stepTitle', { name });
  if (item.professionalRole === 'Trainer') return t('today.questionnaire.stepTitleFallback.Trainer');
  if (item.professionalRole === 'Nutritionist') return t('today.questionnaire.stepTitleFallback.Nutritionist');
  return t('today.questionnaire.stepTitleFallback.other');
}

/** "Questions from Jana"; without a name, the coach is named by role. */
export function formTitle(t: TFunction, item: PendingQuestionnaire): string {
  const name = firstName(item.professionalName?.trim() ?? '');
  if (isCheckInForm(item)) {
    if (name) return t('today.questionnaire.checkInTitle', { name });
    if (item.professionalRole === 'Trainer') return t('today.questionnaire.checkInTitleFallback.Trainer');
    if (item.professionalRole === 'Nutritionist') return t('today.questionnaire.checkInTitleFallback.Nutritionist');
    return t('today.questionnaire.checkInTitleFallback.other');
  }
  if (name) return t('today.questionnaire.title', { name });
  if (item.professionalRole === 'Trainer') return t('today.questionnaire.titleFallback.Trainer');
  if (item.professionalRole === 'Nutritionist') return t('today.questionnaire.titleFallback.Nutritionist');
  return t('today.questionnaire.titleFallback.other');
}
