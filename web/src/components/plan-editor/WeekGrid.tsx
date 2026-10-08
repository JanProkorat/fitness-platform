import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import MacroDots from '@/components/plan-editor/MacroDots';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import {
  DAY_ORDER,
  formatKcal,
  GRID_CLASS,
  mealKindLabelKey,
  WEEK_GRID_CLASS,
  weekGridRows,
} from '@/components/plan-editor/plan-editor-format';
import { CELL_MEAL_DRAG, GRID_CELL_SENSORS, mealItemNames } from '@/components/plan-editor/plan-editor-library';
import {
  dayTotals,
  mealItemCount,
  mealTotals,
  targetStatus,
  type TargetStatus,
  type Totals,
} from '@/components/plan-editor/plan-editor-nutrition';
import { setDayNote, weekRows } from '@/components/plan-editor/plan-editor-ops';
import {
  MAX_NOTE_LENGTH,
  type EditorDay,
  type EditorMeal,
  type EditorWeek,
} from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

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
  const boundary = usePopoverBoundary();
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `cell:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { weekIndex, dayOfWeek, rowIndex },
    disabled: readOnly,
  });
  const itemCount = meal ? mealItemCount(meal) : 0;
  const draggable = !readOnly && itemCount > 0;
  const { ref: dragRef, isDragging } = useDraggable({
    id: `cell-meal:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { type: CELL_MEAL_DRAG, weekIndex, dayOfWeek, rowIndex, mealId: meal?.mealId },
    disabled: !draggable,
    sensors: GRID_CELL_SENSORS,
  });
  // The drag library only gets the element while it can be dragged, so it never marks an empty cell aria-disabled.
  const ref = useCallback(
    (element: Element | null) => {
      dropRef(element);
      dragRef(draggable ? element : null);
    },
    [dropRef, dragRef, draggable],
  );
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
            'flex min-h-0 min-w-0 flex-col items-stretch justify-between gap-1 rounded-xl border p-3 text-left outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50',
            itemCount === 0 && 'border-dashed border-line bg-transparent',
            itemCount > 0 && 'border-raised-line bg-raised shadow-raised',
            draggable &&
              'cursor-grab hover:-translate-y-px hover:shadow-raised-hover active:cursor-grabbing motion-reduce:hover:translate-y-0',
            selected && 'border-solid border-ink ring-2 ring-ink',
            isDragging && 'opacity-50',
            isDropTarget && !isDragging && 'border-dashed border-nutrition bg-nutrition-soft shadow-none ring-0',
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
          collisionBoundary={boundary}
          collisionPadding={16}
          sideOffset={8}
          data-testid="meal-detail"
          className="max-h-(--radix-popover-content-available-height) w-140 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-line bg-card p-5"
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

interface DayHeaderProps {
  day: EditorDay | undefined;
  /** Where the day's note can be edited; without it (or when `readOnly`) the note is shown as text. */
  note?: { weekIndex: number; readOnly: boolean; onEdit: PlanEditorState['edit'] };
}

/** A weekday's name with its note button; the note opens in a small popover. */
export function DayHeader({ day, note: noteEditing }: DayHeaderProps) {
  const { t } = useTranslation();
  const boundary = usePopoverBoundary();
  const [open, setOpen] = useState(false);
  const dayOfWeek = day?.dayOfWeek ?? 1;
  const dayName = t(`planEditor.daysLong.${dayOfWeek}`);
  const note = day?.note?.trim();
  const editable = noteEditing !== undefined && !noteEditing.readOnly;

  return (
    <span className="flex items-center justify-center gap-1.5 text-body font-semibold text-ink">
      {t(`planEditor.days.${dayOfWeek}`)}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="day-note-button"
            data-has-note={note ? 'true' : 'false'}
            aria-label={t(editable ? 'planEditor.dayNoteEdit' : 'planEditor.dayNoteView', { day: dayName })}
            title={note}
            className={cn(
              'flex size-5 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              note ? 'bg-nutrition-soft text-nutrition-ink' : 'bg-muted text-faint',
            )}
          >
            <StickyNote className="size-3" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={8}
            collisionBoundary={boundary}
            collisionPadding={16}
            data-testid="day-note-popover"
            aria-label={dayName}
            className="flex w-72 flex-col gap-2 rounded-2xl border-line bg-card p-4"
          >
            <span className="text-body font-semibold text-ink">{dayName}</span>
            {editable ? (
              <Textarea
                autoFocus
                rows={4}
                value={day?.note ?? ''}
                maxLength={MAX_NOTE_LENGTH}
                aria-label={t('planEditor.dayNoteField', { day: dayName })}
                placeholder={t('planEditor.day.notePlaceholder')}
                onChange={(event) =>
                  noteEditing.onEdit(
                    (doc) => setDayNote(doc, noteEditing.weekIndex, dayOfWeek, event.target.value),
                    `daynote:${noteEditing.weekIndex}:${dayOfWeek}`,
                  )
                }
              />
            ) : (
              <p className="text-copy font-normal text-ink [overflow-wrap:anywhere]">
                {note || t('planEditor.dayNoteNone')}
              </p>
            )}
          </PopoverContent>
        )}
      </Popover>
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
      className="flex h-full min-h-30 min-w-0 flex-col justify-between gap-1 rounded-xl border border-raised-line bg-raised p-3 shadow-raised"
    >
      <span className={cn('text-copy font-semibold', STATUS_TEXT_CLASS[status])}>
        {t('planEditor.cell.kcal', { kcal: formatKcal(totals?.kcal ?? 0, i18n.language) })}
      </span>
      <div className="h-1 w-full shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full', STATUS_BAR_CLASS[status])} style={{ width: `${fill}%` }} />
      </div>
      <span className="text-caption text-ink">
        <MacroDots
          protein={totals?.protein ?? 0}
          carbs={totals?.carbs ?? 0}
          fat={totals?.fat ?? 0}
          fiber={totals?.fiber ?? 0}
        />
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
  onEdit: PlanEditorState['edit'];
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
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const rows = weekRows(week);
  const dayByNumber = new Map(week.days.map((day) => [day.dayOfWeek, day]));

  return (
    <div
      role="group"
      aria-label={t('planEditor.grid.label')}
      className={cn(WEEK_GRID_CLASS, 'flex-1')}
      style={weekGridRows(rows.length, 7.5)}
    >
      <div className={GRID_CLASS}>
        <span />
        {DAY_ORDER.map((dayOfWeek) => (
          <DayHeader
            key={dayOfWeek}
            day={dayByNumber.get(dayOfWeek) ?? { dayOfWeek, meals: [] }}
            note={{ weekIndex, readOnly, onEdit }}
          />
        ))}
      </div>

      <div className={cn(GRID_CLASS, 'items-stretch')}>
        <span className="self-center text-body font-semibold whitespace-nowrap text-muted-foreground">
          {t('planEditor.dayTotal')}
        </span>
        {DAY_ORDER.map((dayOfWeek) => (
          <DayTotalCell key={dayOfWeek} day={dayByNumber.get(dayOfWeek)} target={dailyKcalTarget} />
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.index} className={cn(GRID_CLASS, 'items-stretch')}>
          <span className="self-center text-body font-semibold whitespace-nowrap text-muted-foreground">
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
