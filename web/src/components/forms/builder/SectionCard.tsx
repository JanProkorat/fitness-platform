import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PALETTE_DRAG, QUESTION_DRAG } from '@/components/forms/builder/form-builder-drag';
import KindIcon from '@/components/forms/builder/KindIcon';
import { QuestionKind, type DraftQuestion, type QuestionErrors } from '@/components/forms/builder/form-builder-model';
import { cn } from '@/lib/utils';

interface Props {
  question: DraftQuestion;
  /** Position in the sortable list, sections included. */
  index: number;
  /** One-based position among the sections, used in accessible names. */
  position: number;
  selected: boolean;
  errors?: QuestionErrors;
  onSelect: () => void;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const BARE_INPUT =
  'min-w-0 border-transparent bg-transparent px-2 shadow-none hover:border-line focus-visible:bg-card';

const ICON_BUTTON =
  'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** A slim divider row of the form: a heading and an optional description that groups the questions below it. */
export default function SectionCard({
  question,
  index,
  position,
  selected,
  errors,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
}: Props) {
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

  return (
    <li
      ref={ref}
      data-testid="section-card"
      data-key={question.key}
      data-kind={QuestionKind.Section}
      aria-label={t('forms.builder.section.label', { number: position, title: question.label })}
      onClick={onSelect}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'text') {
          onSelect();
        }
      }}
      className={cn(
        'flex flex-col gap-1 rounded-card border bg-card px-5 py-3 shadow-panel transition-colors',
        selected ? 'border-2 border-ink' : 'border-line hover:border-faint',
        isDragging && 'opacity-50',
        isDropTarget && !isDragging && 'border-ink',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          ref={handleRef}
          type="button"
          aria-label={t('forms.builder.section.reorder', { number: position })}
          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-meta font-semibold text-ink">
          <KindIcon kind={QuestionKind.Section} className="size-3.5 shrink-0" />
          {t('forms.builder.section.chip')}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={t('forms.builder.section.duplicate', { number: position })}
          title={t('forms.builder.card.duplicateTitle')}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          className={cn(ICON_BUTTON, 'hover:text-ink')}
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('forms.builder.section.delete', { number: position })}
          title={t('forms.builder.card.deleteTitle')}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className={cn(ICON_BUTTON, 'hover:text-destructive')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <Input
          value={question.label}
          maxLength={500}
          onChange={(event) => onChange({ label: event.target.value })}
          aria-label={t('forms.builder.section.titleLabel', { number: position })}
          aria-invalid={errors?.label !== undefined}
          placeholder={t('forms.builder.section.titlePlaceholder')}
          className={cn('h-10 font-display text-card-title font-semibold text-ink', BARE_INPUT)}
        />
        {errors?.label && (
          <p role="alert" className="text-meta text-destructive">
            {t(errors.label)}
          </p>
        )}
        <Input
          value={question.helperText}
          maxLength={500}
          onChange={(event) => onChange({ helperText: event.target.value })}
          aria-label={t('forms.builder.section.descriptionLabel', { number: position })}
          placeholder={t('forms.builder.section.descriptionPlaceholder')}
          className={cn('h-8 text-copy text-muted-foreground', BARE_INPUT)}
        />
      </div>
    </li>
  );
}
