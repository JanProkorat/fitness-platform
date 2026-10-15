import { Fragment, useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDragOperation, useDraggable, useDroppable } from '@dnd-kit/react';
import { Plus, StickyNote, X } from 'lucide-react';
import type { MealKind } from '@/api/generated';
import { cn } from '@/lib/utils';
import DayTargetPopover from '@/components/plan-editor/DayTargetPopover';
import MacroDots from '@/components/plan-editor/MacroDots';
import MealRowInsertLine from '@/components/plan-editor/MealRowInsertLine';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import {
  DAY_ORDER,
  formatKcal,
  GRID_CLASS,
  mealKindLabelKey,
  STICKY_LABEL_CLASS,
  WEEK_GRID_CLASS,
  WEEK_GRID_SCROLLER_CLASS,
  weekGridRows,
} from '@/components/plan-editor/plan-editor-format';
import MealGapDropTarget from '@/components/plan-editor/MealGapDropTarget';
import { LabelFrame, LabelHandle } from '@/components/plan-editor/GridLabelDrag';
import type { LabelAxis } from '@/components/plan-editor/plan-editor-ops';
import {
  CELL_MEAL_DRAG,
  GRID_CELL_SENSORS,
  isLabelDrag,
  mealItemNames,
  MOVE_KEY_SHORTCUTS,
  moveDirection,
} from '@/components/plan-editor/plan-editor-library';
import {
  dayTotals,
  mealItemCount,
  mealTotals,
  STATUS_BAR_CLASS,
  STATUS_TEXT_CLASS,
  targetStatus,
  type Totals,
} from '@/components/plan-editor/plan-editor-nutrition';
import { daySlots, rowMeal, setDayNote, weekRows } from '@/components/plan-editor/plan-editor-ops';
import {
  MAX_NOTE_LENGTH,
  type EditorDay,
  type EditorMeal,
  type EditorWeek,
  type PlanTargets,
} from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

/** Minimum height of a meal row, shared by the Meals and Nutrition views so switching between them keeps the tiles the same size. */
export const WEEK_GRID_MIN_ROW_REM = 10;

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

interface CellProps {
  weekIndex: number;
  dayOfWeek: number;
  rowIndex: number;
  /** The label of the row this cell sits in; a meal of another kind says so itself. */
  rowLabelKey: string;
  meal: EditorMeal | undefined;
  selected: boolean;
  readOnly: boolean;
  /** True while a row or day label is dragged: no cell takes a drop then, so only labels can be targets. */
  labelDragging: boolean;
  /** True while this cell's meal detail is open. */
  detailOpen: boolean;
  detail: ReactNode;
  onSelect: () => void;
  onDetailClose: () => void;
  /** Alt+ArrowUp / Alt+ArrowDown on the focused cell: moves its contents one meal up or down the day. */
  onKeyMove?: (direction: -1 | 1) => void;
}

function MealCell({
  weekIndex,
  dayOfWeek,
  rowIndex,
  rowLabelKey,
  meal,
  selected,
  readOnly,
  labelDragging,
  detailOpen,
  detail,
  onSelect,
  onDetailClose,
  onKeyMove,
}: CellProps) {
  const { t, i18n } = useTranslation();
  const boundary = usePopoverBoundary();
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `cell:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { weekIndex, dayOfWeek, rowIndex },
    disabled: readOnly || labelDragging,
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
          aria-keyshortcuts={draggable && onKeyMove ? MOVE_KEY_SHORTCUTS : undefined}
          onKeyDown={(event) => {
            const direction = meal && draggable && onKeyMove ? moveDirection(event) : null;
            if (direction) {
              event.preventDefault();
              onKeyMove?.(direction);
            }
          }}
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
          // No top padding: the card may reach the top of the scroll area, over the day-name row, but never the fixed top bar.
          collisionPadding={{ top: 0, right: 16, bottom: 16, left: 16 }}
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
  /** Makes the day's name draggable onto another day, and Alt+Arrow swap it with the neighbour; off by default. */
  labelDrag?: { weekIndex: number; onKeyMove: (direction: -1 | 1) => void };
}

/** A weekday's name with its note button; the note opens in a small popover. */
export function DayHeader({ day, note: noteEditing, labelDrag }: DayHeaderProps) {
  const { t } = useTranslation();
  const boundary = usePopoverBoundary();
  const [open, setOpen] = useState(false);
  const dayOfWeek = day?.dayOfWeek ?? 1;
  const dayName = t(`planEditor.daysLong.${dayOfWeek}`);
  const note = day?.note?.trim();
  const editable = noteEditing !== undefined && !noteEditing.readOnly;

  const shortName = t(`planEditor.days.${dayOfWeek}`);
  const rootClass = 'flex items-center justify-center gap-1.5 text-body font-semibold text-ink';
  // A plain function, not a component: a component type created here would remount the popover on every render.
  const wrap = (children: ReactNode) =>
    labelDrag ? (
      <LabelFrame axis="day" weekIndex={labelDrag.weekIndex} index={dayOfWeek} className={cn(rootClass, 'self-stretch')}>
        {children}
      </LabelFrame>
    ) : (
      <span className={rootClass}>{children}</span>
    );

  return wrap(
    <>
      {labelDrag ? (
        <LabelHandle
          axis="day"
          weekIndex={labelDrag.weekIndex}
          index={dayOfWeek}
          ariaLabel={t('planEditor.labelDrop.dayAria', { label: dayName })}
          onKeyMove={labelDrag.onKeyMove}
        >
          {shortName}
        </LabelHandle>
      ) : (
        shortName
      )}
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
    </>,
  );
}

interface DayTotalCellProps {
  day: EditorDay | undefined;
  dayOfWeek: number;
  targets: PlanTargets;
}

/** One weekday's totals against the daily targets; opens a popover with every nutrient's planned value and target. */
export function DayTotalCell({ day, dayOfWeek, targets }: DayTotalCellProps) {
  const { t, i18n } = useTranslation();
  const totals = day ? dayTotals(day) : null;
  const target = targets.kcal;
  const status = targetStatus(totals?.kcal ?? 0, target);
  const fill = target && totals ? Math.min(100, (totals.kcal / target) * 100) : 0;

  return (
    <DayTargetPopover dayOfWeek={dayOfWeek} totals={totals} targets={targets} status={status}>
      <span className={cn('text-copy font-semibold', STATUS_TEXT_CLASS[status])}>
        {t('planEditor.cell.kcal', { kcal: formatKcal(totals?.kcal ?? 0, i18n.language) })}
      </span>
      <span className="block h-1 w-full shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className={cn('block h-full rounded-full', STATUS_BAR_CLASS[status])} style={{ width: `${fill}%` }} />
      </span>
      <span className="text-caption text-ink">
        <MacroDots
          protein={totals?.protein ?? 0}
          carbs={totals?.carbs ?? 0}
          fat={totals?.fat ?? 0}
          fiber={totals?.fiber ?? 0}
        />
      </span>
    </DayTargetPopover>
  );
}

export interface SelectedCell {
  dayOfWeek: number;
  rowIndex: number;
}

interface Props {
  week: EditorWeek;
  weekIndex: number;
  targets: PlanTargets;
  selected: SelectedCell | null;
  readOnly: boolean;
  onSelect: (cell: SelectedCell) => void;
  /** The cell whose meal detail is open, if any. */
  detailCell: SelectedCell | null;
  renderDetail: (cell: SelectedCell) => ReactNode;
  onDetailClose: () => void;
  onEdit: PlanEditorState['edit'];
  /** Asks the host to remove a meal row from this week; without it the row labels have no remove button. */
  onRemoveRow?: (rowIndex: number) => void;
  /** Asks the host to add a meal between two rows, given their kinds; without it the rows have no insert line. */
  onInsertBetween?: (above: MealKind, below: MealKind) => void;
  /** Asks the host to add a meal to the whole week; without it there is no "Add meal" button under the labels. */
  onAddMeal?: () => void;
  /** Alt+Arrow on a focused cell: moves that meal's contents one meal up or down its day. */
  onMoveMeal?: (dayOfWeek: number, mealId: string, direction: -1 | 1) => void;
  /**
   * Alt+Arrow on a focused row or day label: swaps it with its neighbour. Without it (or when `readOnly`) the
   * labels cannot be dragged. `index` is the row index of a row label and the weekday of a day label.
   */
  onLabelKeyMove?: (axis: LabelAxis, index: number, direction: -1 | 1) => void;
}

/** The week as a grid: one column per weekday, a day-total row, then one row per meal. */
export default function WeekGrid({
  week,
  weekIndex,
  targets,
  selected,
  readOnly,
  onSelect,
  detailCell,
  renderDetail,
  onDetailClose,
  onEdit,
  onRemoveRow,
  onInsertBetween,
  onAddMeal,
  onMoveMeal,
  onLabelKeyMove,
}: Props) {
  const { t } = useTranslation();
  const { source } = useDragOperation();
  const labelDragging = isLabelDrag(source?.data);
  const labelsDraggable = !readOnly && onLabelKeyMove !== undefined;
  const rows = weekRows(week);
  const dayByNumber = new Map(week.days.map((day) => [day.dayOfWeek, day]));
  const slotIds = new Map(DAY_ORDER.map((dayOfWeek) => [dayOfWeek, daySlots(dayByNumber.get(dayOfWeek)).map((meal) => meal.mealId)]));

  return (
    <div className={WEEK_GRID_SCROLLER_CLASS}>
    <div
      role="group"
      aria-label={t('planEditor.grid.label')}
      className={cn(WEEK_GRID_CLASS, 'flex-1')}
      style={weekGridRows(rows.length, WEEK_GRID_MIN_ROW_REM)}
    >
      <div className={GRID_CLASS}>
        {!readOnly && onAddMeal && rows.length > 0 ? (
          <span className={STICKY_LABEL_CLASS}>
            <button
              type="button"
              data-testid="add-meal-week"
              aria-label={t('planEditor.addMeal.open')}
              title={t('planEditor.addMeal.open')}
              onClick={onAddMeal}
              // The 36px tap target is pulled back into the header row so the corner adds no height.
              className="-my-2 flex size-9 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="size-3.5" aria-hidden="true" />
              </span>
            </button>
          </span>
        ) : (
          <span className={STICKY_LABEL_CLASS} aria-hidden="true">
            &nbsp;
          </span>
        )}
        {DAY_ORDER.map((dayOfWeek) => (
          <DayHeader
            key={dayOfWeek}
            day={dayByNumber.get(dayOfWeek) ?? { dayOfWeek, meals: [] }}
            note={{ weekIndex, readOnly, onEdit }}
            labelDrag={
              labelsDraggable
                ? { weekIndex, onKeyMove: (direction) => onLabelKeyMove?.('day', dayOfWeek, direction) }
                : undefined
            }
          />
        ))}
      </div>

      <div className={cn(GRID_CLASS, 'items-stretch')}>
        <span className={cn(STICKY_LABEL_CLASS, 'self-center text-body font-semibold whitespace-nowrap text-muted-foreground')}>
          {t('planEditor.dayTotal')}
        </span>
        {DAY_ORDER.map((dayOfWeek) => (
          <DayTotalCell key={dayOfWeek} day={dayByNumber.get(dayOfWeek)} dayOfWeek={dayOfWeek} targets={targets} />
        ))}
      </div>

      {rows.map((row, position) => {
        const previous = position > 0 ? rows[position - 1] : undefined;
        const rowName = t(`planEditor.rows.${mealKindLabelKey(row.kind)}`);
        const rowLabelClass = cn(
          STICKY_LABEL_CLASS,
          'group/row flex flex-col items-start justify-center gap-1.5 text-body font-semibold whitespace-nowrap text-muted-foreground',
          labelsDraggable ? 'self-stretch' : 'self-center',
        );
        const rowLabelContent = (
          <span className="flex items-center gap-1.5">
            {labelsDraggable ? (
              <LabelHandle
                axis="row"
                weekIndex={weekIndex}
                index={row.index}
                ariaLabel={t('planEditor.labelDrop.rowAria', { label: rowName })}
                onKeyMove={(direction) => onLabelKeyMove?.('row', row.index, direction)}
              >
                {rowName}
              </LabelHandle>
            ) : (
              rowName
            )}
            {!readOnly && onRemoveRow && (
              <button
                type="button"
                data-testid="remove-row"
                aria-label={t('planEditor.removeRow.aria', { meal: rowName, week: weekIndex + 1 })}
                title={t('planEditor.removeRow.aria', { meal: rowName, week: weekIndex + 1 })}
                onClick={() => onRemoveRow(row.index)}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-card text-error opacity-0 outline-none group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-9 pointer-coarse:opacity-100"
              >
                <X className="size-3 pointer-coarse:size-4" aria-hidden="true" />
              </button>
            )}
          </span>
        );
        return (
        <div key={row.index} className={cn(GRID_CLASS, 'relative items-stretch')}>
          {previous && !readOnly && onInsertBetween && (
            <MealRowInsertLine
              above={t(`planEditor.rows.${mealKindLabelKey(previous.kind)}`)}
              below={t(`planEditor.rows.${mealKindLabelKey(row.kind)}`)}
              onInsert={() => onInsertBetween(previous.kind, row.kind)}
            />
          )}
          {labelsDraggable ? (
            <LabelFrame axis="row" weekIndex={weekIndex} index={row.index} className={rowLabelClass}>
              {rowLabelContent}
            </LabelFrame>
          ) : (
            <span className={rowLabelClass}>{rowLabelContent}</span>
          )}
          {DAY_ORDER.map((dayOfWeek) => {
            const detailOpen = detailCell?.dayOfWeek === dayOfWeek && detailCell.rowIndex === row.index;
            const cellMeal = rowMeal(dayByNumber.get(dayOfWeek), row);
            const daySlotIds = slotIds.get(dayOfWeek) ?? [];
            const slotIndex = cellMeal ? daySlotIds.indexOf(cellMeal.mealId) : -1;
            // Gaps sit in the day's own column: above each of its meals, and below its last one.
            const gapStyle = { gridColumnStart: DAY_ORDER.indexOf(dayOfWeek) + 2 };
            return (
              <Fragment key={dayOfWeek}>
              {!readOnly && cellMeal && slotIndex !== -1 && (
                <MealGapDropTarget
                  weekIndex={weekIndex}
                  dayOfWeek={dayOfWeek}
                  gapIndex={slotIndex}
                  slotMealIds={daySlotIds}
                  style={gapStyle}
                />
              )}
              {!readOnly && cellMeal && slotIndex === daySlotIds.length - 1 && (
                <MealGapDropTarget
                  weekIndex={weekIndex}
                  dayOfWeek={dayOfWeek}
                  gapIndex={daySlotIds.length}
                  slotMealIds={daySlotIds}
                  edge="below"
                  style={gapStyle}
                />
              )}
              <MealCell
                weekIndex={weekIndex}
                dayOfWeek={dayOfWeek}
                rowIndex={row.index}
                rowLabelKey={mealKindLabelKey(row.kind)}
                meal={cellMeal}
                selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === row.index}
                readOnly={readOnly}
                labelDragging={labelDragging}
                detailOpen={detailOpen}
                detail={detailOpen ? renderDetail({ dayOfWeek, rowIndex: row.index }) : null}
                onSelect={() => onSelect({ dayOfWeek, rowIndex: row.index })}
                onDetailClose={onDetailClose}
                onKeyMove={
                  onMoveMeal && cellMeal ? (direction) => onMoveMeal(dayOfWeek, cellMeal.mealId, direction) : undefined
                }
              />
              </Fragment>
            );
          })}
        </div>
        );
      })}
    </div>
    </div>
  );
}
