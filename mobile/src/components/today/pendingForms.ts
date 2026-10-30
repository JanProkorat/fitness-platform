import type { TFunction } from 'i18next';

import type { PendingQuestionnaire } from '@/api/questionnaires';
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
  if (name) return t('today.questionnaire.title', { name });
  if (item.professionalRole === 'Trainer') return t('today.questionnaire.titleFallback.Trainer');
  if (item.professionalRole === 'Nutritionist') return t('today.questionnaire.titleFallback.Nutritionist');
  return t('today.questionnaire.titleFallback.other');
}
