import {
  FormResponseState,
  QuestionnaireResponseKind,
  type ClientFormItem,
} from '@/api/questionnaires';
import { isNumericAnswer } from '@/components/client-forms/answerValues';

/** Short day and month in the UI language, e.g. "20 Oct"; empty for a missing or invalid date. */
export function formatFormDate(value: string | undefined, language: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

/** How many number and scale answers a check-in card summarises. */
export const CHECK_IN_SUMMARY_COUNT = 3;

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The cards the plan editor shows from the current collaboration: every onboarding form and questionnaire in
 * server order, and only the latest answered or missed check-in (waiting ones are left out).
 */
export function selectPlanEditorForms(current: readonly ClientFormItem[] | undefined): ClientFormItem[] {
  const items = current ?? [];
  const latestCheckIn = items
    .filter((item) => item.kind === QuestionnaireResponseKind.CheckIn && item.state !== FormResponseState.Waiting)
    .reduce<ClientFormItem | undefined>((best, item) => {
      if (!best) {
        return item;
      }
      const bestWeek = timestamp(best.checkInWeekStart) || timestamp(best.sentAt);
      const itemWeek = timestamp(item.checkInWeekStart) || timestamp(item.sentAt);
      return itemWeek > bestWeek ? item : best;
    }, undefined);

  return items.filter((item) => item.kind !== QuestionnaireResponseKind.CheckIn || item === latestCheckIn);
}

/** Only answered forms open; waiting and missed cards are not clickable. */
export function isOpenable(item: ClientFormItem): boolean {
  return item.state === FormResponseState.Answered;
}

/** The first few number and scale answers of a form, for the check-in card. */
export function checkInSummary(item: ClientFormItem): { label: string; value: number }[] {
  return (item.answers ?? [])
    .filter(isNumericAnswer)
    .slice(0, CHECK_IN_SUMMARY_COUNT)
    .flatMap((answer) =>
      answer.valueNumber == null ? [] : [{ label: answer.questionLabel ?? '', value: answer.valueNumber }],
    );
}
