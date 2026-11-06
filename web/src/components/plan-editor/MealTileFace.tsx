import { useTranslation } from 'react-i18next';
import { Check, Contrast, Lock, X } from 'lucide-react';
import { MealLockState } from '@/api/generated';
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

/** What a locked tile adds to its face: the eaten state and how much of the meal was eaten. */
export interface TileLock {
  state: MealLockState;
  eaten: number;
  total: number;
  /** kcal the tile shows after the chip: what was eaten, from the snapshot. Without it the meal's own total shows. */
  kcal?: number;
}

const LOCK_CHIP_CLASS: Record<MealLockState, string> = {
  [MealLockState.Open]: '',
  [MealLockState.Eaten]: 'text-success-ink',
  [MealLockState.PartlyEaten]: 'text-caution-ink',
  [MealLockState.Missed]: 'text-error',
};

function LockChip({ lock }: { lock: TileLock }) {
  const { t } = useTranslation();
  const Icon = lock.state === MealLockState.Eaten ? Check : lock.state === MealLockState.PartlyEaten ? Contrast : X;
  const label =
    lock.state === MealLockState.Eaten
      ? t('planEditor.locks.state.eaten')
      : lock.state === MealLockState.PartlyEaten
        ? t('planEditor.locks.state.partlyShort', { eaten: lock.eaten, total: lock.total })
        : t('planEditor.locks.state.missed');
  return (
    <span
      data-testid="meal-lock-chip"
      data-state={lock.state}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 text-meta font-semibold',
        LOCK_CHIP_CLASS[lock.state],
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

interface Props {
  /** The meal whose contents the face shows, or undefined for a cell the day has no meal for. */
  meal: EditorMeal | undefined;
  /** The label of the row the face sits in; a meal of another kind says so itself. */
  rowLabelKey: string;
  /** Lets the grid find this face to slide it from one cell to another. */
  flipKey?: string;
  /** Set on a locked meal: the eaten state shows as a chip and a lock marks the corner. */
  lock?: TileLock;
  /** A slot on a past day with no meal: it reads "Nothing planned" and cannot be filled. */
  pastEmpty?: boolean;
  /** The red conflict badge takes the lock icon's corner, so the icon steps aside. */
  conflictFlag?: boolean;
}

/**
 * What a week-grid tile shows: the meal's contents. The tile (button) around it stays in its cell; only the
 * face slides, so the tile's own hover lift never fights the slide.
 */
export default function MealTileFace({ meal, rowLabelKey, flipKey, lock, pastEmpty = false, conflictFlag = false }: Props) {
  const { t, i18n } = useTranslation();
  const itemCount = meal ? mealItemCount(meal) : 0;
  const names = meal ? mealItemNames(meal, i18n.language) : [];
  const totals = meal ? mealTotals(meal) : null;
  const ownKeyDiffers = meal !== undefined && mealKindLabelKey(meal.kind) !== rowLabelKey;
  const extraNames = names.slice(1);
  const shownLock = lock && lock.state !== MealLockState.Open ? lock : undefined;
  const missed = shownLock?.state === MealLockState.Missed;

  return (
    <span data-flip-key={flipKey} className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-between gap-1">
      {itemCount === 0 ? (
        <span className="m-auto flex items-center gap-1.5 text-body text-muted-foreground">
          {pastEmpty && <Lock className="size-3.5" aria-hidden="true" />}
          {pastEmpty ? t('planEditor.locks.nothingPlanned') : t('planEditor.cell.empty')}
        </span>
      ) : (
        <>
          {lock && !conflictFlag && <Lock data-testid="meal-lock-icon" className="absolute top-0 right-0 size-3.5 text-muted-foreground" aria-hidden="true" />}
          <span
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]',
              lock && 'pr-5',
            )}
          >
            {ownKeyDiffers && meal && (
              <span className="truncate text-label font-bold tracking-label text-nutrition-ink uppercase">
                {t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`)}
              </span>
            )}
            <span className={cn('truncate text-copy font-semibold', missed ? 'text-muted-foreground' : 'text-ink')}>{names[0]}</span>
            {extraNames.map((name, index) => (
              <span key={`${name}-${index}`} className="truncate text-body text-muted-foreground">
                + {name}
              </span>
            ))}
          </span>
          <span className="flex shrink-0 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-body font-semibold text-ink">
              {shownLock && <LockChip lock={shownLock} />}
              {/* min-w keeps the figure from being squeezed to nothing beside the chip; it still truncates when narrow. */}
              <span className={cn('truncate', shownLock && 'min-w-9', missed && 'text-muted-foreground')}>
                {t('planEditor.cell.kcal', { kcal: formatKcal(shownLock?.kcal ?? totals?.kcal ?? 0, i18n.language) })}
                {itemCount > 1 && !shownLock && (
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {t('planEditor.cell.items', { count: itemCount })}
                  </span>
                )}
              </span>
            </span>
            {totals && <MacroBar totals={totals} />}
          </span>
        </>
      )}
    </span>
  );
}
