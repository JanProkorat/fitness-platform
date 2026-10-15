import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import MacroDots from '@/components/plan-editor/MacroDots';
import { formatKcal, mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { mealItemNames } from '@/components/plan-editor/plan-editor-library';
import { mealItemCount, mealTotals, type Totals } from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorMeal } from '@/components/plan-editor/plan-editor-types';

interface MacroBarProps {
  totals: Totals;
  /** Shows each segment's value above the bar while it is hovered; off by default so tiles keep their height. */
  labels?: boolean;
}

export function MacroBar({ totals, labels = false }: MacroBarProps) {
  const parts = [
    { key: 'protein', weight: totals.protein * 4, className: 'bg-macro-protein' },
    { key: 'carbs', weight: totals.carbs * 4, className: 'bg-macro-carbs' },
    { key: 'fat', weight: totals.fat * 9, className: 'bg-macro-fat' },
  ];
  const sum = parts.reduce((total, part) => total + part.weight, 0);
  const bar = (
    <div className="flex h-1 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
      {parts.map((part) => (
        <span
          key={part.key}
          className={cn('h-full rounded-full', part.className)}
          style={{ flexGrow: sum > 0 ? part.weight : 1, flexBasis: 0 }}
        />
      ))}
    </div>
  );
  if (!labels) {
    return bar;
  }
  return (
    <div data-testid="macro-bar" className="group/macro relative py-2">
      {bar}
      <span
        data-testid="macro-bar-values"
        className="pointer-events-none invisible absolute right-0 bottom-full left-0 z-10 flex justify-center rounded-md bg-card px-1.5 py-0.5 text-meta whitespace-nowrap text-ink group-hover/macro:visible"
      >
        <MacroDots protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
      </span>
    </div>
  );
}

interface Props {
  /** The meal whose contents the face shows, or undefined for a cell the day has no meal for. */
  meal: EditorMeal | undefined;
  /** The label of the row the face sits in; a meal of another kind says so itself. */
  rowLabelKey: string;
  /** Lets the grid find this face to slide it from one cell to another. */
  flipKey?: string;
}

/**
 * What a week-grid tile shows: the meal's contents. The tile (button) around it stays in its cell; only the
 * face slides, so the tile's own hover lift never fights the slide.
 */
export default function MealTileFace({ meal, rowLabelKey, flipKey }: Props) {
  const { t, i18n } = useTranslation();
  const itemCount = meal ? mealItemCount(meal) : 0;
  const names = meal ? mealItemNames(meal, i18n.language) : [];
  const totals = meal ? mealTotals(meal) : null;
  const ownKeyDiffers = meal !== undefined && mealKindLabelKey(meal.kind) !== rowLabelKey;
  const extraNames = names.slice(1);

  return (
    <span data-flip-key={flipKey} className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-between gap-1">
      {itemCount === 0 ? (
        <span className="m-auto text-body text-muted-foreground">{t('planEditor.cell.empty')}</span>
      ) : (
        <>
          <span className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]">
            {ownKeyDiffers && meal && (
              <span className="truncate text-label font-bold tracking-label text-nutrition-ink uppercase">
                {t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`)}
              </span>
            )}
            <span className="truncate text-copy font-semibold text-ink">{names[0]}</span>
            {extraNames.map((name, index) => (
              <span key={`${name}-${index}`} className="truncate text-body text-muted-foreground">
                + {name}
              </span>
            ))}
          </span>
          <span className="flex shrink-0 flex-col gap-1.5">
            <span className="truncate text-body font-semibold text-ink">
              {t('planEditor.cell.kcal', { kcal: formatKcal(totals?.kcal ?? 0, i18n.language) })}
              {itemCount > 1 && (
                <span className="font-normal text-muted-foreground">
                  {' · '}
                  {t('planEditor.cell.items', { count: itemCount })}
                </span>
              )}
            </span>
            {totals && <MacroBar totals={totals} />}
          </span>
        </>
      )}
    </span>
  );
}
