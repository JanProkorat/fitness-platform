import type { ClientFormAnswer } from '@/api/questionnaires';

/** Choices of a multi-select answer; an unreadable value yields no choices. */
export function parseChoices(valueJson: string | undefined): string[] {
  if (!valueJson) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(valueJson);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** True when the answer holds a number the card summaries can show (number and scale questions). */
export function isNumericAnswer(answer: ClientFormAnswer): boolean {
  return (answer.questionType === 'number' || answer.questionType === 'scale') && answer.valueNumber != null;
}
