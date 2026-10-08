import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/react';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { DAY_ORDER, formatKcal, GRID_CLASS, mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { mealItemNames } from '@/components/plan-editor/plan-editor-library';
import {
  dayTotals,
  mealItemCount,
  mealTotals,
  targetStatus,
  type TargetStatus,
  type Totals,
} from '@/components/plan-editor/plan-editor-nutrition';
import { weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { EditorDay, EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';

const STATUS_TEXT_CLASS: Record<TargetStatus, string> = {
  none: 'text-ink',
  on: 'text-success',
  near: 'text-training',
  off: 'text-error',
};
const STATUS_BAR_CLASS: Record<TargetStatus, string> = {
  none: 'bg-ink',
  on: 'bg-success',
  near: 'bg-training-bright',
  off: 'bg-error',
};

export function MacroBar({ totals }: { totals: Totals }) {
  const parts = [
    { key: 'protein', weight: totals.protein * 4, className: 'bg-macro-protein' },
    { key: 'carbs', weight: totals.carbs * 4, className: 'bg-macro-carbs' },
    { key: 'fat', weight: totals.fat * 9, className: 'bg-macro-fat' },
  ];
  const sum = parts.reduce((total, part) => total + part.weight, 0);
  return (
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
}

interface CellProps {
  weekIndex: number;
  dayOfWeek: number;
  rowIndex: number;
  /** The label of the row this cell sits in; a meal of another kind says so itself. */
  rowLabelKey: string;
  meal: EditorMeal | undefined;
  selected: boolean;
  readOnly: boolean;
  /** True while this cell's meal detail is open. */
  detailOpen: boolean;
  detail: ReactNode;
  onSelect: () => void;
  onDetailClose: () => void;
}

function MealCell({
  weekIndex,
  dayOfWeek,
  rowIndex,
  rowLabelKey,
  meal,
  selected,
  readOnly,
  detailOpen,
  detail,
  onSelect,
  onDetailClose,
}: CellProps) {
  const { t, i18n } = useTranslation();
  const { ref, isDropTarget } = useDroppable({
    id: `cell:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { weekIndex, dayOfWeek, rowIndex },
    disabled: readOnly,
  });
  const itemCount = meal ? mealItemCount(meal) : 0;
  const names = meal ? mealItemNames(meal, i18n.language) : [];
  const totals = meal ? mealTotals(meal) : null;
  const ownKeyDiffers = meal !== undefined && mealKindLabelKey(meal.kind) !== rowLabelKey;
  const extraNames = names.slice(1);

  return (
    <Popover
      open={detailOpen}
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          onDetailClose();
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          ref={ref}
          data-testid="meal-cell"
          data-day={dayOfWeek}
          data-row={rowIndex}
          aria-pressed={selected}
          aria-expanded={meal && itemCount > 0 ? detailOpen : undefined}
          aria-label={t('planEditor.cell.label', { day: t(`planEditor.days.${dayOfWeek}`), row: rowIndex + 1 })}
          onClick={onSelect}
          className={cn(
            'flex min-h-0 min-w-0 flex-col items-stretch justify-between gap-1 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
            itemCount === 0 && 'border-dashed border-line bg-transparent',
            itemCount > 0 && 'border-line bg-card',
            selected && 'border-solid border-ink ring-2 ring-ink',
            isDropTarget && 'border-dashed border-nutrition bg-nutrition-soft ring-0',
          )}
        >
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
        </button>
      </PopoverAnchor>
      {detailOpen && (
        <PopoverContent
          side="bottom"
          align="center"
          collisionPadding={16}
          sideOffset={8}
          data-testid="meal-detail"
          className="max-h-(--radix-popover-content-available-height) w-lg overflow-y-auto rounded-2xl border-line bg-card p-5"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target;
            // The library stays usable while a meal is open, and a cell click decides open/close itself.
            if (target instanceof Element && target.closest('[data-plan-library],[data-testid="meal-cell"]')) {
              event.preventDefault();
            }
          }}
        >
          {detail}
        </PopoverContent>
      )}
    </Popover>
  );
}

export function DayHeader({ day }: { day: EditorDay | undefined }) {
  const { t } = useTranslation();
  const note = day?.note?.trim();
  return (
    <span className="flex items-center justify-center gap-1.5 text-body font-semibold text-ink">
      {t(`planEditor.days.${day?.dayOfWeek ?? 1}`)}
      {note ? (
        <span
          title={note}
          role="img"
          aria-label={t('planEditor.dayNote', { note })}
          className="flex size-5 items-center justify-center rounded-md bg-nutrition-soft text-nutrition-ink"
        >
          <StickyNote className="size-3" aria-hidden="true" />
        </span>
      ) : (
        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-faint" aria-hidden="true">
          <StickyNote className="size-3" />
        </span>
      )}
    </span>
  );
}

export function DayTotalCell({ day, target }: { day: EditorDay | undefined; target: number | undefined }) {
  const { t, i18n } = useTranslation();
  const totals = day ? dayTotals(day) : null;
  const status = targetStatus(totals?.kcal ?? 0, target);
  const fill = target && totals ? Math.min(100, (totals.kcal / target) * 100) : 0;

  return (
    <div
      data-testid="day-total"
      data-status={status}
      className="flex h-30 min-w-0 flex-col justify-between rounded-xl border border-line bg-card p-3"
    >
      <span className={cn('text-copy font-semibold', STATUS_TEXT_CLASS[status])}>
        {t('planEditor.cell.kcal', { kcal: formatKcal(totals?.kcal ?? 0, i18n.language) })}
      </span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full', STATUS_BAR_CLASS[status])} style={{ width: `${fill}%` }} />
      </div>
      <span className="text-caption text-muted-foreground">
        {t('planEditor.cell.macros', {
          protein: Math.round(totals?.protein ?? 0),
          carbs: Math.round(totals?.carbs ?? 0),
          fat: Math.round(totals?.fat ?? 0),
          fiber: Math.round(totals?.fiber ?? 0),
        })}
      </span>
    </div>
  );
}

export interface SelectedCell {
  dayOfWeek: number;
  rowIndex: number;
}

interface Props {
  week: EditorWeek;
  weekIndex: number;
  dailyKcalTarget: number | undefined;
  selected: SelectedCell | null;
  readOnly: boolean;
  onSelect: (cell: SelectedCell) => void;
  /** The cell whose meal detail is open, if any. */
  detailCell: SelectedCell | null;
  renderDetail: (cell: SelectedCell) => ReactNode;
  onDetailClose: () => void;
}

/** The week as a grid: one column per weekday, a day-total row, then one row per meal. */
export default function WeekGrid({
  week,
  weekIndex,
  dailyKcalTarget,
  selected,
  readOnly,
  onSelect,
  detailCell,
  renderDetail,
  onDetailClose,
}: Props) {
  const { t } = useTranslation();
  const rows = weekRows(week);
  const dayByNumber = new Map(week.days.map((day) => [day.dayOfWeek, day]));

  return (
    <div role="group" aria-label={t('planEditor.grid.label')} className="flex flex-1 flex-col gap-3">
      <div className={GRID_CLASS}>
        <span />
        {DAY_ORDER.map((dayOfWeek) => (
          <DayHeader key={dayOfWeek} day={dayByNumber.get(dayOfWeek) ?? { dayOfWeek, meals: [] }} />
        ))}
      </div>

      <div className={GRID_CLASS}>
        <span className="text-body font-semibold text-muted-foreground">{t('planEditor.dayTotal')}</span>
        {DAY_ORDER.map((dayOfWeek) => (
          <DayTotalCell key={dayOfWeek} day={dayByNumber.get(dayOfWeek)} target={dailyKcalTarget} />
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.index} className={cn(GRID_CLASS, 'min-h-30 flex-1 items-stretch')}>
          <span className="self-center text-body font-semibold text-muted-foreground">
            {t(`planEditor.rows.${mealKindLabelKey(row.kind)}`)}
          </span>
          {DAY_ORDER.map((dayOfWeek) => {
            const detailOpen = detailCell?.dayOfWeek === dayOfWeek && detailCell.rowIndex === row.index;
            return (
              <MealCell
                key={dayOfWeek}
                weekIndex={weekIndex}
                dayOfWeek={dayOfWeek}
                rowIndex={row.index}
                rowLabelKey={mealKindLabelKey(row.kind)}
                meal={dayByNumber.get(dayOfWeek)?.meals[row.index]}
                selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === row.index}
                readOnly={readOnly}
                detailOpen={detailOpen}
                detail={detailOpen ? renderDetail({ dayOfWeek, rowIndex: row.index }) : null}
                onSelect={() => onSelect({ dayOfWeek, rowIndex: row.index })}
                onDetailClose={onDetailClose}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
