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

const RATING_TYPES = ['smiley_rating', 'star_rating'];

/** True for the smiley and star rating questions, which store only a 1-5 number. */
export function isRatingAnswer(answer: ClientFormAnswer): boolean {
  return answer.questionType != null && RATING_TYPES.includes(answer.questionType);
}

/** True when the answer holds a number the card summaries can show (number, scale and rating questions). */
export function isNumericAnswer(answer: ClientFormAnswer): boolean {
  return (answer.questionType === 'number' || answer.questionType === 'scale' || isRatingAnswer(answer)) && answer.valueNumber != null;
}
