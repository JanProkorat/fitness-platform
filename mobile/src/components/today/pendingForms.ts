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

/** "N questions"; empty when the server reports none the client can answer. */
export function questionCountHint(t: TFunction, item: PendingQuestionnaire): string | undefined {
  const count = item.questionCount ?? 0;
  return count > 0 ? t('today.questionnaire.count', { count }) : undefined;
}

/** "Questions from Jana"; without a name, the coach is named by role. */
export function formTitle(t: TFunction, item: PendingQuestionnaire): string {
  const name = firstName(item.professionalName?.trim() ?? '');
  if (name) return t('today.questionnaire.title', { name });
  if (item.professionalRole === 'Trainer') return t('today.questionnaire.titleFallback.Trainer');
  if (item.professionalRole === 'Nutritionist') return t('today.questionnaire.titleFallback.Nutritionist');
  return t('today.questionnaire.titleFallback.other');
}
