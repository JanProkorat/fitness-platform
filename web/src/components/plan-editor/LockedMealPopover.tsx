import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Contrast, Lock, StickyNote, X } from 'lucide-react';
import { MealLockState, SeenMealItemKind } from '@/api/generated';
import MacroDots from '@/components/plan-editor/MacroDots';
import type { MealLockView } from '@/components/plan-editor/meal-locks';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { mealItemEntries, type Totals } from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorMeal } from '@/components/plan-editor/plan-editor-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ItemRow {
  key: string;
  name: string;
  kind: 'recipe' | 'food';
  amount: number;
  totals: Totals;
  eaten: boolean;
}

/** The items as they stood when the client ate (the snapshot), or the meal's current items when there is none. */
function itemRows(meal: EditorMeal, lock: MealLockView, language: string): ItemRow[] {
  const eatenIds = new Set(lock.info?.eatenItemIds ?? []);
  const snapshot = lock.info?.snapshot ?? [];
  if (snapshot.length > 0) {
    return snapshot.map((item, index) => ({
      key: item.itemId ?? `${index}`,
      name: item.name ?? '',
      kind: item.kind === SeenMealItemKind.Recipe ? 'recipe' : 'food',
      amount: item.amount ?? 0,
      totals: {
        kcal: item.kcal ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        fiber: item.fibre ?? 0,
      },
      eaten: item.itemId !== undefined && eatenIds.has(item.itemId),
    }));
  }
  return mealItemEntries(meal, language).map((entry) => {
    const itemId = entry.type === 'recipe' ? meal.recipes[entry.index]?.itemId : meal.foods[entry.index]?.itemId;
    return {
      key: `${entry.type}:${entry.index}`,
      name: entry.name,
      kind: entry.type,
      amount: entry.amount,
      totals: entry.totals,
      eaten: itemId !== undefined && eatenIds.has(itemId),
    };
  });
}

function sumTotals(rows: readonly ItemRow[]): Totals {
  return rows.reduce<Totals>(
    (sum, row) => ({
      kcal: sum.kcal + row.totals.kcal,
      protein: sum.protein + row.totals.protein,
      carbs: sum.carbs + row.totals.carbs,
      fat: sum.fat + row.totals.fat,
      fiber: sum.fiber + row.totals.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

const STATE_ICON_CLASS: Record<MealLockState, string> = {
  [MealLockState.Open]: 'bg-muted text-muted-foreground',
  [MealLockState.Eaten]: 'bg-success-soft text-success-ink',
  [MealLockState.PartlyEaten]: 'bg-caution-soft text-caution-ink',
  [MealLockState.Missed]: 'bg-error-soft text-error',
};

interface Props {
  meal: EditorMeal;
  lock: MealLockView;
  clientName: string;
  dayOfWeek: number;
  /** The slot's calendar date (YYYY-MM-DD); null when the plan has no start date. */
  date: string | null;
  pastDay: boolean;
  language: string;
  onClose: () => void;
  onOpenDay: () => void;
}

/** What opens from a locked meal: what the client ate of it, read-only, with the way on to its day. */
export default function LockedMealPopover({
  meal,
  lock,
  clientName,
  dayOfWeek,
  date,
  pastDay,
  language,
  onClose,
  onOpenDay,
}: Props) {
  const { t } = useTranslation();
  const rows = itemRows(meal, lock, language);
  const eatenRows = rows.filter((row) => row.eaten);
  const planned = sumTotals(rows);
  const eaten = sumTotals(eatenRows);
  const percent = planned.kcal > 0 ? Math.round((eaten.kcal / planned.kcal) * 100) : 0;
  const kindLabel = t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`);
  const dayShort = t(`planEditor.days.${dayOfWeek}`);
  const dayLong = t(`planEditor.daysLong.${dayOfWeek}`);
  const dateLabel = date
    ? new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
    : null;
  const eatenTime =
    lock.state === MealLockState.Eaten && lock.info?.eatenAt
      ? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(lock.info.eatenAt))
      : null;
  const Icon = lock.state === MealLockState.Eaten ? Check : lock.state === MealLockState.PartlyEaten ? Contrast : X;
  const chipLabel =
    lock.state === MealLockState.Eaten
      ? t('planEditor.locks.state.eaten')
      : lock.state === MealLockState.PartlyEaten
        ? t('planEditor.locks.state.partly', { eaten: eatenRows.length, total: rows.length })
        : t('planEditor.locks.state.missed');
  const hasSnapshot = (lock.info?.snapshot.length ?? 0) > 0;

  return (
    <div data-testid="locked-meal-popover" data-state={lock.state} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', STATE_ICON_CLASS[lock.state])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-display text-card-title font-semibold text-ink">
            {kindLabel} · {dayShort}
            {dateLabel ? ` ${dateLabel}` : ''}
          </h3>
          <p className="flex items-center gap-1.5 text-body text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            {pastDay ? t('planEditor.locks.reason.past') : t('planEditor.locks.reason.eaten')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('planEditor.locks.close')}
          onClick={onClose}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-meta font-semibold',
              STATE_ICON_CLASS[lock.state],
            )}
          >
            <Icon className="size-3" aria-hidden="true" />
            {chipLabel}
          </span>
          <span className="text-copy font-semibold text-ink">
            {t('planEditor.locks.kcalOf', { eaten: Math.round(eaten.kcal), planned: Math.round(planned.kcal) })}
          </span>
          {eatenTime && (
            <span data-testid="locked-meal-eaten-at" className="text-body text-muted-foreground">
              {t('planEditor.locks.eatenAt', { time: eatenTime })}
            </span>
          )}
          <span className="ml-auto text-body text-muted-foreground">{t('planEditor.locks.percent', { percent })}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        {eatenRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 text-body text-muted-foreground">
            {t('planEditor.locks.eatenMacros')}
            <MacroDots protein={eaten.protein} carbs={eaten.carbs} fat={eaten.fat} />
          </div>
        )}
      </div>

      <ul className="flex flex-col rounded-xl border border-line px-4">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            {row.eaten ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-card">
                <Check className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t('planEditor.locks.item.eaten')}</span>
              </span>
            ) : (
              <span className="size-6 shrink-0 rounded-full border-2 border-line" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-copy font-semibold text-ink">{row.name}</span>
              <span className="text-body text-muted-foreground">
                {t(row.kind === 'recipe' ? 'planEditor.locks.item.recipe' : 'planEditor.locks.item.food', {
                  amount: Math.round(row.amount * 10) / 10,
                })}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-copy font-semibold text-ink">
                {t('planEditor.cell.kcal', { kcal: Math.round(row.totals.kcal) })}
              </span>
              {!row.eaten && <span className="text-meta font-semibold text-caution-ink">{t('planEditor.locks.item.notEaten')}</span>}
            </div>
          </li>
        ))}
      </ul>

      {meal.note && (
        <p className="flex items-start gap-2 text-body text-ink">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">{t('planEditor.locks.yourNote')} · </span>
            {meal.note}
          </span>
        </p>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <p className="min-w-0 text-body text-muted-foreground">
          {hasSnapshot ? t('planEditor.locks.snapshotNote', { name: clientName }) : t('planEditor.locks.lockedNote')}
        </p>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={onOpenDay}>
          {t('planEditor.locks.openDay', { day: dayLong })}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
