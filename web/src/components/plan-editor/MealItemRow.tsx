import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { Apple, ChefHat, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MacroDots from '@/components/plan-editor/MacroDots';
import { MacroBar } from '@/components/plan-editor/WeekGrid';
import { MEAL_ITEM_DRAG } from '@/components/plan-editor/plan-editor-library';
import type { MealItemEntry } from '@/components/plan-editor/plan-editor-nutrition';
import { MAX_GRAMS, MAX_SERVINGS } from '@/components/plan-editor/plan-editor-types';

type AmountUnit = 'g' | 'portion';

/** Grams are whole numbers 1-10000; portions are above 0, at most 100, one decimal. Anything else is null. */
function parseAmount(text: string, unit: AmountUnit): number | null {
  const normalized = text.trim().replace(',', '.');
  if (unit === 'g') {
    if (!/^\d+$/.test(normalized)) {
      return null;
    }
    const grams = Number(normalized);
    return grams >= 1 && grams <= MAX_GRAMS ? grams : null;
  }
  if (!/^\d+(\.\d)?$/.test(normalized)) {
    return null;
  }
  const servings = Number(normalized);
  return servings > 0 && servings <= MAX_SERVINGS ? servings : null;
}

interface AmountInputProps {
  value: number;
  unit: AmountUnit;
  label: string;
  onCommit: (value: number) => void;
  className?: string;
}

/** Number box with its unit inside. An invalid entry is flagged and never committed; blur restores the last good value. */
export function AmountInput({ value, unit, label, onCommit, className }: AmountInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (parseAmount(text, unit) !== value) {
      setText(String(value));
    }
  }
  const invalid = parseAmount(text, unit) === null && text !== String(value);

  return (
    <div className={cn('relative w-36 shrink-0', className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseAmount(event.target.value, unit);
          if (parsed !== null && parsed !== value) {
            onCommit(parsed);
          }
        }}
        onBlur={() => {
          if (parseAmount(text, unit) === null) {
            setText(String(value));
          }
        }}
        className="h-10 pr-16 text-copy font-semibold"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body text-muted-foreground">
        {unit === 'g' ? t('planEditor.units.g') : t('planEditor.units.portion')}
      </span>
    </div>
  );
}

interface Props {
  entry: MealItemEntry;
  readOnly: boolean;
  variant: 'day' | 'popover';
  /** Where the row lives, so it can be dragged to another place in its own recipe or ingredient list. */
  position: { weekIndex: number; dayOfWeek: number; mealId: string };
  onAmount: (value: number) => void;
  onRemove: () => void;
}

/** One recipe or ingredient of a meal: name, amount, kcal and a remove button. Draggable within its list. */
export default function MealItemRow({ entry, readOnly, variant, position, onAmount, onRemove }: Props) {
  const { t } = useTranslation();
  const list = `${position.mealId}:${entry.type}`;
  // Only the meal popover reorders; the Day view's cards stay as they were (a row drag inside a sortable card misplaces the drag preview there).
  const draggable = !readOnly && variant === 'popover';
  // No optimistic sorting: rows are keyed by position, so moving DOM nodes ahead of the state change would swap them twice.
  const { ref, isDragging, isDropTarget } = useSortable({
    id: `${list}:${entry.index}`,
    index: entry.index,
    group: list,
    type: `meal-item:${list}`,
    plugins: [],
    disabled: !draggable,
    data: {
      type: MEAL_ITEM_DRAG,
      weekIndex: position.weekIndex,
      dayOfWeek: position.dayOfWeek,
      mealId: position.mealId,
      kind: entry.type,
      index: entry.index,
    },
  });
  const unit: AmountUnit = entry.type === 'recipe' ? 'portion' : 'g';
  const typeLabel = t(entry.type === 'recipe' ? 'planEditor.itemType.recipe' : 'planEditor.itemType.food');
  const { totals } = entry;
  const detail =
    variant === 'popover' ? (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span>{typeLabel}</span>
        <MacroDots protein={totals.protein} carbs={totals.carbs} fat={totals.fat} fiber={totals.fiber} />
      </span>
    ) : (
      <span className="truncate">{typeLabel}</span>
    );
  const Icon = entry.type === 'recipe' ? ChefHat : Apple;

  return (
    <li
      ref={draggable ? ref : undefined}
      data-testid="meal-item"
      data-kind={entry.type}
      className={cn(
        'flex items-center gap-3',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        isDropTarget && !isDragging && 'rounded-lg bg-nutrition-soft',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-nutrition-soft text-nutrition-ink',
          variant === 'day' ? 'size-10' : 'size-9',
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-copy font-semibold text-ink',
            variant === 'day' ? 'truncate' : '[overflow-wrap:anywhere]',
          )}
        >
          {entry.name}
        </span>
        <span className="text-meta text-muted-foreground">{detail}</span>
      </span>
      {readOnly ? (
        <span className="w-24 shrink-0 text-right text-copy text-ink">
          {entry.amount} {unit === 'g' ? t('planEditor.units.g') : t('planEditor.units.portion')}
        </span>
      ) : (
        <AmountInput
          value={entry.amount}
          unit={unit}
          label={t('planEditor.item.amountLabel', { name: entry.name })}
          onCommit={onAmount}
          className={variant === 'popover' ? 'w-28' : undefined}
        />
      )}
      <span
        className={cn(
          'shrink-0 text-right text-copy',
          variant === 'day' ? 'w-20 font-semibold text-ink' : 'w-16 text-muted-foreground',
        )}
      >
        {t('planEditor.cell.kcal', { kcal: Math.round(totals.kcal) })}
      </span>
      {variant === 'day' && (
        <span className="hidden w-40 shrink-0 xl:block">
          <MacroBar totals={totals} />
        </span>
      )}
      {!readOnly ? (
        <button
          type="button"
          aria-label={t('planEditor.item.remove', { name: entry.name })}
          onClick={onRemove}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <span className="size-8 shrink-0" aria-hidden="true" />
      )}
    </li>
  );
}
