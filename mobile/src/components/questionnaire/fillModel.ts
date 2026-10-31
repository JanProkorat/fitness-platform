import type { AnswerPayload, ClientAnswer, ClientQuestion } from '@/api/questionnaires';

export type FillKind =
  | 'single_choice'
  | 'multi_select'
  | 'short_text'
  | 'number'
  | 'smiley_rating'
  | 'star_rating'
  | 'scale';

/** One answerable question with its config already read. */
export type FillQuestion = {
  id: string;
  kind: FillKind;
  label: string;
  helper: string | null;
  required: boolean;
  options: string[];
  allowOther: boolean;
  min: number | null;
  max: number | null;
  step: number;
  /** Number answers must be whole (a scale too wide for the pill track falls back to a number field). */
  integer: boolean;
  unit: string | null;
  /** Words under the two ends of a smiley rating; null when the coach set none. */
  lowLabel: string | null;
  highLabel: string | null;
};

/**
 * One screen of the flow. `section` steps group questions under a heading (`title` is null for
 * questions before the first heading); `single` steps hold one question, for forms without sections.
 */
export type FillStep = {
  key: string;
  type: 'section' | 'single';
  title: string | null;
  questions: FillQuestion[];
};

/** What the client has entered for one question; only the fields its kind uses are read. */
export type Draft = {
  /** short_text value, the chosen single_choice option, or the raw number field text. */
  text: string;
  /** Rating or scale value. */
  number: number | null;
  /** multi_select picks. */
  selected: string[];
  otherOn: boolean;
  other: string;
};

export type Drafts = Record<string, Draft>;

export type AnswerState = 'empty' | 'answered' | 'invalid';

export const EMPTY_DRAFT: Draft = { text: '', number: null, selected: [], otherOn: false, other: '' };

export const RATING_MAX = 5;
const DEFAULT_SCALE_MIN = 1;
const DEFAULT_SCALE_MAX = 10;
/** Widest scale that still reads well as a track of numbered pills. */
const MAX_SCALE_PILLS = 11;
export const SHORT_TEXT_MAX_LENGTH = 2000;

const ANSWERABLE: ReadonlySet<string> = new Set<FillKind>([
  'single_choice',
  'multi_select',
  'short_text',
  'number',
  'smiley_rating',
  'star_rating',
  'scale',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Question config JSON with lower-cased keys (the server reads it case-insensitively); `{}` when unreadable. */
function parseConfig(config: string | undefined): Record<string, unknown> {
  if (!config) return {};
  try {
    const parsed: unknown = JSON.parse(config);
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key.toLowerCase(), value]));
  } catch {
    return {};
  }
}

function toFillQuestion(question: ClientQuestion): FillQuestion | null {
  const type = question.type ?? '';
  if (!question.publicId || !ANSWERABLE.has(type)) return null;
  let kind = type as FillKind;
  const config = parseConfig(question.config);
  let min = finiteNumber(config.min);
  let max = finiteNumber(config.max);
  let integer = false;
  let unit: string | null = null;

  if (kind === 'scale') {
    min = Math.round(min ?? DEFAULT_SCALE_MIN);
    max = Math.round(max ?? DEFAULT_SCALE_MAX);
    if (max - min + 1 > MAX_SCALE_PILLS) {
      kind = 'number';
      integer = true;
    }
  } else if (kind === 'number') {
    unit = typeof config.unit === 'string' && config.unit.trim() ? config.unit.trim() : null;
  } else {
    min = null;
    max = null;
  }

  const step = finiteNumber(config.step);
  return {
    id: question.publicId,
    kind,
    label: question.label ?? '',
    helper: question.helperText?.trim() ? question.helperText.trim() : null,
    required: question.isRequired === true,
    options: Array.isArray(config.options)
      ? config.options.filter((option): option is string => typeof option === 'string' && option.length > 0)
      : [],
    allowOther: config.allowother === true,
    min,
    max,
    step: integer ? Math.max(1, Math.round(step ?? 1)) : step !== null && step > 0 ? step : 1,
    integer,
    unit,
    lowLabel: readLabel(config.lowlabel),
    highLabel: readLabel(config.highlabel),
  };
}

const readLabel = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Lays the questionnaire out as steps. Sections become one step each; a form without any section
 * heading gets one question per step. File-upload and unknown question types are left out entirely,
 * and a section left with no visible question gets no step.
 */
export function buildSteps(questions: readonly ClientQuestion[]): FillStep[] {
  const ordered = [...questions].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const hasSections = ordered.some((question) => question.type === 'section');
  const groups: { title: string | null; questions: FillQuestion[] }[] = [];

  for (const question of ordered) {
    if (question.type === 'section') {
      groups.push({ title: question.label ?? '', questions: [] });
      continue;
    }
    const fill = toFillQuestion(question);
    if (!fill) continue;
    if (!hasSections) {
      groups.push({ title: null, questions: [fill] });
      continue;
    }
    if (groups.length === 0) groups.push({ title: null, questions: [] });
    groups[groups.length - 1]?.questions.push(fill);
  }

  return groups
    .filter((group) => group.questions.length > 0)
    .map((group, index) => ({
      key: `${index}`,
      type: hasSections ? 'section' : 'single',
      title: group.title,
      questions: group.questions,
    }));
}

/** Parses a typed number: `null` when blank, `undefined` when it is not a number. */
export function parseDecimal(text: string): number | null | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Trims float noise left by stepping in fractions. */
export const roundValue = (value: number): number => Math.round(value * 10_000) / 10_000;

export const inRange = (question: FillQuestion, value: number): boolean =>
  (question.min === null || value >= question.min) &&
  (question.max === null || value <= question.max) &&
  (!question.integer || Number.isInteger(value));

export function answerState(question: FillQuestion, draft: Draft): AnswerState {
  switch (question.kind) {
    case 'single_choice':
      return (draft.otherOn ? draft.other.trim() : draft.text) ? 'answered' : 'empty';
    case 'multi_select':
      return draft.selected.length > 0 || (draft.otherOn && draft.other.trim()) ? 'answered' : 'empty';
    case 'short_text':
      return draft.text.trim() ? 'answered' : 'empty';
    case 'number': {
      const value = parseDecimal(draft.text);
      if (value === null) return 'empty';
      return value !== undefined && inRange(question, value) ? 'answered' : 'invalid';
    }
    case 'smiley_rating':
    case 'star_rating':
    case 'scale':
      return draft.number === null ? 'empty' : 'answered';
  }
}

/** True when the step cannot be passed: a required question is unanswered or a number is out of range. */
export function stepBlocked(step: FillStep, drafts: Drafts): boolean {
  return step.questions.some((question) => {
    const state = answerState(question, drafts[question.id] ?? EMPTY_DRAFT);
    return state === 'invalid' || (state === 'empty' && question.required);
  });
}

export const stepsBlocked = (steps: readonly FillStep[], drafts: Drafts): boolean =>
  steps.some((step) => stepBlocked(step, drafts));

export function countAnswered(steps: readonly FillStep[], drafts: Drafts): number {
  return steps.reduce(
    (total, step) =>
      total +
      step.questions.filter((question) => answerState(question, drafts[question.id] ?? EMPTY_DRAFT) === 'answered')
        .length,
    0,
  );
}

/** The saved answers as drafts, so a half-finished response opens where it was left. */
export function prefillDrafts(steps: readonly FillStep[], answers: readonly ClientAnswer[] | undefined): Drafts {
  const drafts: Drafts = {};
  const byQuestion = new Map(answers?.map((answer) => [answer.questionPublicId, answer]));

  for (const question of steps.flatMap((step) => step.questions)) {
    const saved = byQuestion.get(question.id);
    if (!saved) continue;
    const draft: Draft = { ...EMPTY_DRAFT };

    switch (question.kind) {
      case 'single_choice':
        if (saved.valueText && question.options.includes(saved.valueText)) {
          draft.text = saved.valueText;
        } else if (saved.valueText && question.allowOther) {
          draft.otherOn = true;
          draft.other = saved.valueText;
        }
        break;
      case 'multi_select': {
        const picked = readStringArray(saved.valueJson);
        draft.selected = question.options.filter((option) => picked.includes(option));
        if (saved.valueText && question.allowOther) {
          draft.otherOn = true;
          draft.other = saved.valueText;
        }
        break;
      }
      case 'short_text':
        draft.text = saved.valueText ?? '';
        break;
      case 'number':
        draft.text = saved.valueNumber === undefined ? '' : String(saved.valueNumber);
        break;
      case 'smiley_rating':
      case 'star_rating':
      case 'scale':
        draft.number = saved.valueNumber === undefined ? null : Math.round(saved.valueNumber);
        break;
    }
    drafts[question.id] = draft;
  }
  return drafts;
}

function readStringArray(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** One answer per visible question; an unanswered one carries no value, which clears it on the server. */
export function buildAnswers(steps: readonly FillStep[], drafts: Drafts): AnswerPayload[] {
  return steps.flatMap((step) =>
    step.questions.map((question): AnswerPayload => {
      const draft = drafts[question.id] ?? EMPTY_DRAFT;
      const answer: AnswerPayload = { questionPublicId: question.id };
      switch (question.kind) {
        case 'single_choice': {
          const text = draft.otherOn ? draft.other.trim() : draft.text;
          if (text) answer.valueText = text;
          break;
        }
        case 'multi_select': {
          if (draft.selected.length > 0) answer.valueJson = JSON.stringify(draft.selected);
          if (draft.otherOn && draft.other.trim()) answer.valueText = draft.other.trim();
          break;
        }
        case 'short_text':
          if (draft.text.trim()) answer.valueText = draft.text.trim();
          break;
        case 'number': {
          const value = parseDecimal(draft.text);
          if (typeof value === 'number') answer.valueNumber = value;
          break;
        }
        case 'smiley_rating':
        case 'star_rating':
        case 'scale':
          if (draft.number !== null) answer.valueNumber = draft.number;
          break;
      }
      return answer;
    }),
  );
}
