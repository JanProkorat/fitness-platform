import { z } from 'zod';
import {
  QuestionnaireType,
  type QuestionDto,
  type QuestionnaireDto,
  type UpdateQuestionDto,
} from '@/api/questionnaires';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;

/** Question type identifiers as stored by the backend (`QuestionTypes`). */
export const QuestionKind = {
  SingleChoice: 'single_choice',
  MultiSelect: 'multi_select',
  ShortText: 'short_text',
  Number: 'number',
  SmileyRating: 'smiley_rating',
  StarRating: 'star_rating',
} as const;

export type PaletteKind = (typeof QuestionKind)[keyof typeof QuestionKind];

const PALETTE_ORDER: Record<QuestionnaireType, PaletteKind[]> = {
  [QuestionnaireType.Onboarding]: [
    QuestionKind.MultiSelect,
    QuestionKind.Number,
    QuestionKind.SingleChoice,
    QuestionKind.ShortText,
    QuestionKind.SmileyRating,
    QuestionKind.StarRating,
  ],
  [QuestionnaireType.CheckIn]: [
    QuestionKind.SmileyRating,
    QuestionKind.StarRating,
    QuestionKind.MultiSelect,
    QuestionKind.SingleChoice,
    QuestionKind.ShortText,
    QuestionKind.Number,
  ],
};

/** The standard question types in the order the board lists them for this form type. */
export function paletteKinds(type: QuestionnaireType): PaletteKind[] {
  return PALETTE_ORDER[type];
}

export function isChoiceKind(kind: string): boolean {
  return kind === QuestionKind.SingleChoice || kind === QuestionKind.MultiSelect;
}

/** True for the six types the builder can edit; `scale`, `file_upload` and unknown types stay read-only. */
export function isEditableKind(kind: string): kind is PaletteKind {
  return (
    kind === QuestionKind.SingleChoice ||
    kind === QuestionKind.MultiSelect ||
    kind === QuestionKind.ShortText ||
    kind === QuestionKind.Number ||
    kind === QuestionKind.SmileyRating ||
    kind === QuestionKind.StarRating
  );
}

export interface DraftQuestion {
  /** Client-side identity for React keys and drag ids; not sent to the server. */
  key: string;
  /** Server id of an existing question; null for a new or duplicated one. */
  publicId: string | null;
  /** Profile mapping of an existing question, kept as stored. Never copied to a duplicate. */
  mappedField: string | null;
  type: string;
  label: string;
  helperText: string;
  isRequired: boolean;
  options: string[];
  allowOther: boolean;
  min: string;
  max: string;
  unit: string;
  lowLabel: string;
  highLabel: string;
  /** Config keys the builder does not edit (for example a number's `step`), carried through a save. */
  extraConfig: Record<string, unknown>;
  /** The stored config of a type without an editor, sent back unchanged. */
  rawConfig: string | null;
}

export interface DraftForm {
  title: string;
  description: string;
  isDefault: boolean;
  questions: DraftQuestion[];
}

/** Server-owned values the builder never edits but must send back on every save. */
export interface FormServerState {
  publicId: string;
  type: QuestionnaireType;
  isActive: boolean;
  /** Questions with answers that were removed earlier; sent back unchanged after the visible ones. */
  hidden: QuestionDto[];
}

let keyCounter = 0;

export function nextQuestionKey(): string {
  keyCounter += 1;
  return `q${Date.now().toString(36)}-${keyCounter}`;
}

function parseConfig(config: string | null | undefined): Record<string, unknown> {
  if (!config) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(config);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumberText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

const MANAGED_KEYS: Record<string, string[]> = {
  [QuestionKind.SingleChoice]: ['options', 'allowOther'],
  [QuestionKind.MultiSelect]: ['options', 'allowOther'],
  [QuestionKind.Number]: ['min', 'max', 'unit'],
  [QuestionKind.SmileyRating]: ['lowLabel', 'highLabel'],
};

function emptyQuestion(type: string): DraftQuestion {
  return {
    key: nextQuestionKey(),
    publicId: null,
    mappedField: null,
    type,
    label: '',
    helperText: '',
    isRequired: false,
    options: [],
    allowOther: false,
    min: '',
    max: '',
    unit: '',
    lowLabel: '',
    highLabel: '',
    extraConfig: {},
    rawConfig: null,
  };
}

/** Builds the editable draft of a stored question. A config that does not parse falls back to defaults. */
export function toDraftQuestion(dto: QuestionDto): DraftQuestion {
  const question = emptyQuestion(dto.type);
  question.key = dto.publicId;
  question.publicId = dto.publicId;
  question.mappedField = dto.mappedField ?? null;
  question.label = dto.label;
  question.helperText = dto.helperText ?? '';
  question.isRequired = dto.isRequired;
  if (!isEditableKind(dto.type)) {
    question.rawConfig = dto.config ?? null;
    return question;
  }
  const config = parseConfig(dto.config);
  const managed = MANAGED_KEYS[dto.type] ?? [];
  question.extraConfig = Object.fromEntries(Object.entries(config).filter(([name]) => !managed.includes(name)));
  if (isChoiceKind(dto.type)) {
    question.options = Array.isArray(config.options)
      ? config.options.filter((option): option is string => typeof option === 'string')
      : [];
    question.allowOther = config.allowOther === true;
  } else if (dto.type === QuestionKind.Number) {
    question.min = readNumberText(config.min);
    question.max = readNumberText(config.max);
    question.unit = readString(config.unit);
  } else if (dto.type === QuestionKind.SmileyRating) {
    question.lowLabel = readString(config.lowLabel);
    question.highLabel = readString(config.highLabel);
  }
  return question;
}

export interface QuestionDefaults {
  label: string;
  option: (index: number) => string;
  lowLabel: string;
  highLabel: string;
}

/** A fresh question of a palette type, with placeholder copy so it is valid to save straight away. */
export function createQuestion(kind: PaletteKind, defaults: QuestionDefaults): DraftQuestion {
  const question = emptyQuestion(kind);
  question.label = defaults.label;
  if (isChoiceKind(kind)) {
    question.options = [defaults.option(1), defaults.option(2)];
  } else if (kind === QuestionKind.SmileyRating) {
    question.lowLabel = defaults.lowLabel;
    question.highLabel = defaults.highLabel;
  }
  return question;
}

/** A copy with a new identity; it gets no server id and no profile mapping. */
export function duplicateQuestion(source: DraftQuestion): DraftQuestion {
  return {
    ...source,
    key: nextQuestionKey(),
    publicId: null,
    mappedField: null,
    options: [...source.options],
    extraConfig: { ...source.extraConfig },
  };
}

export function toDraftForm(dto: QuestionnaireDto): { draft: DraftForm; server: FormServerState } {
  const ordered = [...dto.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    draft: {
      title: dto.title,
      description: dto.description ?? '',
      isDefault: dto.isDefault,
      questions: ordered.filter((question) => !question.isHidden).map(toDraftQuestion),
    },
    server: {
      publicId: dto.publicId,
      type: dto.type,
      isActive: dto.isActive,
      hidden: ordered.filter((question) => question.isHidden),
    },
  };
}

function parseNumberText(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** The config JSON string the backend expects for a question, or null when the type has none. */
export function serializeConfig(question: DraftQuestion): string | null {
  switch (question.type) {
    case QuestionKind.SingleChoice:
    case QuestionKind.MultiSelect:
      return JSON.stringify({
        ...question.extraConfig,
        options: question.options.map((option) => option.trim()),
        allowOther: question.allowOther,
      });
    case QuestionKind.Number: {
      const min = parseNumberText(question.min);
      const max = parseNumberText(question.max);
      const unit = question.unit.trim();
      const config: Record<string, unknown> = { ...question.extraConfig };
      if (min !== null) {
        config.min = min;
      }
      if (max !== null) {
        config.max = max;
      }
      if (unit !== '') {
        config.unit = unit;
      }
      return Object.keys(config).length === 0 ? null : JSON.stringify(config);
    }
    case QuestionKind.SmileyRating:
      return JSON.stringify({
        ...question.extraConfig,
        lowLabel: question.lowLabel.trim(),
        highLabel: question.highLabel.trim(),
      });
    case QuestionKind.ShortText:
    case QuestionKind.StarRating:
      return null;
    default:
      return question.rawConfig;
  }
}

/** The PUT body: visible questions numbered 0..n-1, then the hidden ones untouched, plus the stored flags. */
export function toUpdatePayload(draft: DraftForm, server: FormServerState) {
  const visible: UpdateQuestionDto[] = draft.questions.map((question, index) => ({
    publicId: question.publicId,
    orderIndex: index,
    type: question.type,
    label: question.label.trim(),
    helperText: question.helperText.trim() === '' ? null : question.helperText.trim(),
    isRequired: question.isRequired,
    isHidden: false,
    config: serializeConfig(question),
    mappedField: question.mappedField,
  }));
  const hidden: UpdateQuestionDto[] = server.hidden.map((question, index) => ({
    publicId: question.publicId,
    orderIndex: visible.length + index,
    type: question.type,
    label: question.label,
    helperText: question.helperText ?? null,
    isRequired: question.isRequired,
    isHidden: true,
    config: question.config ?? null,
    mappedField: question.mappedField ?? null,
  }));
  const description = draft.description.trim();
  return {
    title: draft.title.trim(),
    description: description === '' ? null : description,
    type: server.type,
    isActive: server.isActive,
    isDefault: server.type === QuestionnaireType.Onboarding ? draft.isDefault : false,
    questions: [...visible, ...hidden],
  };
}

/** Rough completion time: one minute per two questions, at least one. */
export function estimateMinutes(questionCount: number): number {
  return Math.max(1, Math.ceil(questionCount / 2));
}

const questionSchema = z
  .object({
    key: z.string(),
    type: z.string(),
    label: z.string().trim().min(1, 'forms.builder.errors.label'),
    options: z.array(z.string()),
    min: z.string(),
    max: z.string(),
    lowLabel: z.string(),
    highLabel: z.string(),
  })
  .superRefine((question, context) => {
    if (isChoiceKind(question.type)) {
      if (question.options.length === 0 || question.options.some((option) => option.trim() === '')) {
        context.addIssue({ code: 'custom', path: ['options'], message: 'forms.builder.errors.options' });
      }
    } else if (question.type === QuestionKind.Number) {
      const min = parseNumberText(question.min);
      const max = parseNumberText(question.max);
      const minBad = question.min.trim() !== '' && min === null;
      const maxBad = question.max.trim() !== '' && max === null;
      if (minBad || maxBad) {
        context.addIssue({ code: 'custom', path: ['range'], message: 'forms.builder.errors.numberInvalid' });
      } else if (min !== null && max !== null && min > max) {
        context.addIssue({ code: 'custom', path: ['range'], message: 'forms.builder.errors.numberRange' });
      }
    } else if (question.type === QuestionKind.SmileyRating) {
      if (question.lowLabel.trim() === '' || question.highLabel.trim() === '') {
        context.addIssue({ code: 'custom', path: ['labels'], message: 'forms.builder.errors.smileyLabels' });
      }
    }
  });

/** Mirrors the backend rules (title 1-200, description up to 1000, `QuestionConfigChecker.IsValid`) so a save never 400s on them. */
const formSchema = z.object({
  title: z.string().trim().min(1, 'forms.builder.errors.title').max(TITLE_MAX_LENGTH, 'forms.builder.errors.title'),
  description: z.string().max(DESCRIPTION_MAX_LENGTH, 'forms.builder.errors.description'),
  questions: z.array(questionSchema),
});

export interface QuestionErrors {
  label?: string;
  options?: string;
  range?: string;
  labels?: string;
}

export interface FormErrors {
  title?: string;
  description?: string;
  /** Per question key. */
  questions: Record<string, QuestionErrors>;
  count: number;
}

/** Validates a draft; every message is an i18n key. */
export function validateDraft(draft: DraftForm): FormErrors {
  const result = formSchema.safeParse(draft);
  const errors: FormErrors = { questions: {}, count: 0 };
  if (result.success) {
    return errors;
  }
  for (const issue of result.error.issues) {
    errors.count += 1;
    const [root, index, field] = issue.path;
    if (root === 'title') {
      errors.title = issue.message;
    } else if (root === 'description') {
      errors.description = issue.message;
    } else if (root === 'questions' && typeof index === 'number' && typeof field === 'string') {
      const question = draft.questions[index];
      if (question) {
        const entry = (errors.questions[question.key] ??= {});
        entry[field as keyof QuestionErrors] = issue.message;
      }
    }
  }
  return errors;
}
