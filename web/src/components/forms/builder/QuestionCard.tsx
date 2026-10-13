import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { Copy, GripVertical, Plus, Smile, Star, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { optionDragType, PALETTE_DRAG, QUESTION_DRAG } from '@/components/forms/builder/form-builder-drag';
import { kindNameKey } from '@/components/forms/builder/form-builder-kinds';
import KindIcon from '@/components/forms/builder/KindIcon';
import {
  isChoiceKind,
  isEditableKind,
  QuestionKind,
  type DraftQuestion,
  type QuestionErrors,
} from '@/components/forms/builder/form-builder-model';
import { cn } from '@/lib/utils';

const SCALE_FACES = [1, 2, 3, 4, 5];

interface OptionRowProps {
  question: DraftQuestion;
  index: number;
  error: boolean;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

/** One choice: grip, text and remove. Dragging the grip reorders it inside its own question. */
function OptionRow({ question, index, error, onChange, onRemove }: OptionRowProps) {
  const { t } = useTranslation();
  const type = optionDragType(question.key);
  // No optimistic sorting: rows are keyed by position, so moving DOM nodes ahead of the state change would swap them twice.
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: `${question.key}:opt:${index}`,
    index,
    group: type,
    type,
    accept: type,
    plugins: [],
    data: { kind: 'option', questionKey: question.key, index },
  });

  return (
    <li
      ref={ref}
      data-testid="option-row"
      className={cn(
        'flex items-center gap-1.5 rounded-field border border-line bg-card px-2',
        isDragging && 'opacity-50',
        isDropTarget && !isDragging && 'border-ink',
        error && 'border-destructive',
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={t('forms.builder.choice.reorder', { number: index + 1 })}
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </button>
      <Input
        value={question.options[index] ?? ''}
        onChange={(event) => onChange(index, event.target.value)}
        aria-label={t('forms.builder.choice.label', { number: index + 1 })}
        aria-invalid={error}
        maxLength={200}
        className="h-10 min-w-0 flex-1 border-transparent bg-transparent px-1 text-copy shadow-none focus-visible:ring-0"
      />
      <button
        type="button"
        aria-label={t('forms.builder.choice.remove', { number: index + 1 })}
        onClick={() => onRemove(index)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation();
  return message ? (
    <p role="alert" className="text-meta text-destructive">
      {t(message)}
    </p>
  ) : null;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function LabelledSwitch({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      {label}
    </label>
  );
}

interface EditorProps {
  question: DraftQuestion;
  errors?: QuestionErrors;
  onChange: (patch: Partial<DraftQuestion>) => void;
}

function ChoiceEditor({ question, errors, onChange }: EditorProps) {
  const { t } = useTranslation();
  const blankOptions = new Set(
    question.options.flatMap((option, index) => (option.trim() === '' ? [index] : [])),
  );
  const showBlank = errors?.options !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {question.options.map((_, index) => (
          <OptionRow
            // Rows are positional; the question key scopes them to this card.
            key={`${question.key}:${index}`}
            question={question}
            index={index}
            error={showBlank && blankOptions.has(index)}
            onChange={(position, value) =>
              onChange({ options: question.options.map((option, at) => (at === position ? value : option)) })
            }
            onRemove={(position) => onChange({ options: question.options.filter((_, at) => at !== position) })}
          />
        ))}
      </ul>
      <FieldError message={errors?.options} />
      <button
        type="button"
        onClick={() =>
          onChange({ options: [...question.options, t('forms.builder.defaults.option', { number: question.options.length + 1 })] })
        }
        className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-field border border-dashed border-line text-copy font-semibold text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('forms.builder.choice.add')}
      </button>
    </div>
  );
}

function NumberEditor({ question, errors, onChange }: EditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t('forms.builder.number.min')}
          <Input
            inputMode="decimal"
            value={question.min}
            onChange={(event) => onChange({ min: event.target.value })}
            aria-invalid={errors?.range !== undefined}
            className="h-10 w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t('forms.builder.number.max')}
          <Input
            inputMode="decimal"
            value={question.max}
            onChange={(event) => onChange({ max: event.target.value })}
            aria-invalid={errors?.range !== undefined}
            className="h-10 w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t('forms.builder.number.unit')}
          <Input
            value={question.unit}
            maxLength={30}
            onChange={(event) => onChange({ unit: event.target.value })}
            className="h-10 w-36"
          />
        </label>
      </div>
      <FieldError message={errors?.range} />
    </div>
  );
}

function SmileyEditor({ question, errors, onChange }: EditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t('forms.builder.smiley.low')}
          <Input
            value={question.lowLabel}
            maxLength={60}
            onChange={(event) => onChange({ lowLabel: event.target.value })}
            aria-invalid={errors?.labels !== undefined && question.lowLabel.trim() === ''}
            className="h-10 w-48"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t('forms.builder.smiley.high')}
          <Input
            value={question.highLabel}
            maxLength={60}
            onChange={(event) => onChange({ highLabel: event.target.value })}
            aria-invalid={errors?.labels !== undefined && question.highLabel.trim() === ''}
            className="h-10 w-48"
          />
        </label>
      </div>
      <FieldError message={errors?.labels} />
    </div>
  );
}

/** What a client sees for a question when its editor is closed. */
function QuestionSummary({ question }: { question: DraftQuestion }) {
  const { t } = useTranslation();
  const chip = 'rounded-field border border-line bg-card px-3 py-1.5 text-body text-muted-foreground';

  if (isChoiceKind(question.type)) {
    return (
      <ul className="flex flex-wrap gap-2">
        {question.options.map((option, index) => (
          <li key={index} className={chip}>
            {option}
          </li>
        ))}
        {question.allowOther && <li className={chip}>{t('forms.builder.choice.other')}</li>}
      </ul>
    );
  }
  if (question.type === QuestionKind.Number) {
    return (
      <div className="flex flex-wrap gap-2">
        {question.min !== '' && <span className={chip}>{t('forms.builder.number.summaryMin', { value: question.min })}</span>}
        {question.max !== '' && <span className={chip}>{t('forms.builder.number.summaryMax', { value: question.max })}</span>}
        {question.unit !== '' && <span className={chip}>{t('forms.builder.number.summaryUnit', { value: question.unit })}</span>}
      </div>
    );
  }
  if (question.type === QuestionKind.ShortText) {
    return (
      <p className="rounded-field border border-line bg-card px-3 py-3 text-body text-muted-foreground">
        {t('forms.builder.text.placeholder')}
      </p>
    );
  }
  if (question.type === QuestionKind.SmileyRating) {
    return (
      <div className="flex gap-3">
        {SCALE_FACES.map((face) => (
          <div key={face} className="flex w-16 flex-col items-center gap-1">
            <span className="flex size-10 items-center justify-center rounded-full border border-line bg-card text-ink">
              <Smile className="size-5" aria-hidden="true" />
            </span>
            <span className="text-meta text-muted-foreground">
              {face === 1 ? question.lowLabel : face === SCALE_FACES.length ? question.highLabel : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (question.type === QuestionKind.StarRating) {
    return (
      <div className="flex gap-1.5 text-muted-foreground">
        {SCALE_FACES.map((star) => (
          <Star key={star} className="size-6" aria-hidden="true" />
        ))}
      </div>
    );
  }
  return <p className="text-body text-muted-foreground">{t('forms.builder.generic.hint')}</p>;
}

interface Props {
  question: DraftQuestion;
  index: number;
  selected: boolean;
  errors?: QuestionErrors;
  onSelect: () => void;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const BARE_INPUT =
  'min-w-0 border-transparent bg-transparent px-2 shadow-none hover:border-line focus-visible:bg-card';

/** One question of the form: header with handle, title and helper text, then its editor when selected. */
export default function QuestionCard({ question, index, selected, errors, onSelect, onChange, onDuplicate, onDelete }: Props) {
  const { t } = useTranslation();
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: question.key,
    index,
    group: QUESTION_DRAG,
    type: QUESTION_DRAG,
    accept: [QUESTION_DRAG, PALETTE_DRAG],
    plugins: [],
    data: { kind: 'question', key: question.key },
  });
  const kindName = t(kindNameKey(question.type));
  const editable = isEditableKind(question.type);

  return (
    <li
      ref={ref}
      data-testid="question-card"
      data-key={question.key}
      data-kind={question.type}
      aria-label={t('forms.builder.card.label', { number: index + 1, title: question.label })}
      onClick={onSelect}
      onFocusCapture={onSelect}
      className={cn(
        'flex flex-col gap-3 rounded-card border bg-card p-5 shadow-panel transition-colors',
        selected ? 'border-2 border-ink' : 'border-line hover:border-faint',
        isDragging && 'opacity-50',
        isDropTarget && !isDragging && 'border-ink',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          ref={handleRef}
          type="button"
          aria-label={t('forms.builder.card.reorder', { number: index + 1 })}
          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-meta font-bold text-on-dark"
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-body font-semibold text-muted-foreground">
          <KindIcon kind={question.type} className="size-4 shrink-0" />
          <span className="truncate">{kindName}</span>
        </span>
        {question.isRequired && !selected && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-meta font-semibold text-ink">
            {t('forms.builder.card.required')}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          aria-label={t('forms.builder.card.duplicate', { number: index + 1 })}
          title={t('forms.builder.card.duplicateTitle')}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('forms.builder.card.delete', { number: index + 1 })}
          title={t('forms.builder.card.deleteTitle')}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <Input
          value={question.label}
          maxLength={500}
          onChange={(event) => onChange({ label: event.target.value })}
          aria-label={t('forms.builder.card.titleLabel', { number: index + 1 })}
          aria-invalid={errors?.label !== undefined}
          placeholder={t('forms.builder.card.titlePlaceholder')}
          className={cn('h-10 font-display text-card-title font-semibold text-ink', BARE_INPUT)}
        />
        <FieldError message={errors?.label} />
        <Input
          value={question.helperText}
          maxLength={500}
          onChange={(event) => onChange({ helperText: event.target.value })}
          aria-label={t('forms.builder.card.helperLabel', { number: index + 1 })}
          placeholder={t('forms.builder.card.helperPlaceholder')}
          className={cn('h-8 text-copy text-muted-foreground', BARE_INPUT)}
        />
      </div>

      {selected ? (
        <div className="flex flex-col gap-3">
          {isChoiceKind(question.type) && <ChoiceEditor question={question} errors={errors} onChange={onChange} />}
          {question.type === QuestionKind.Number && <NumberEditor question={question} errors={errors} onChange={onChange} />}
          {question.type === QuestionKind.SmileyRating && (
            <SmileyEditor question={question} errors={errors} onChange={onChange} />
          )}
          {!editable && <p className="text-body text-muted-foreground">{t('forms.builder.generic.hint')}</p>}
          <div className="flex flex-wrap items-center gap-5">
            <LabelledSwitch
              label={t('forms.builder.card.requiredToggle')}
              checked={question.isRequired}
              onChange={(isRequired) => onChange({ isRequired })}
            />
            {isChoiceKind(question.type) && (
              <LabelledSwitch
                label={t('forms.builder.choice.allowOther')}
                checked={question.allowOther}
                onChange={(allowOther) => onChange({ allowOther })}
              />
            )}
          </div>
        </div>
      ) : (
        <QuestionSummary question={question} />
      )}
    </li>
  );
}
