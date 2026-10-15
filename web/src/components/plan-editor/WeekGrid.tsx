import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { Plus, StickyNote, X } from 'lucide-react';
import type { MealKind } from '@/api/generated';
import { cn } from '@/lib/utils';
import DayTargetPopover from '@/components/plan-editor/DayTargetPopover';
import MacroDots from '@/components/plan-editor/MacroDots';
import MealTileFace from '@/components/plan-editor/MealTileFace';
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
import { LabelFrame, LabelHandle } from '@/components/plan-editor/GridLabelDrag';
import type { LabelAxis } from '@/components/plan-editor/plan-editor-ops';
import {
  CELL_MEAL_DRAG,
  GRID_CELL_SENSORS,
  gridFaceKey,
  MOVE_KEY_SHORTCUTS,
  moveDirection,
  tileSurfaceClass,
  type GridDragView,
} from '@/components/plan-editor/plan-editor-library';
import {
  dayTotals,
  mealItemCount,
  STATUS_BAR_CLASS,
  STATUS_TEXT_CLASS,
  targetStatus,
} from '@/components/plan-editor/plan-editor-nutrition';
import { rowMeal, setDayNote, weekRows } from '@/components/plan-editor/plan-editor-ops';
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

export { MacroBar } from '@/components/plan-editor/MealTileFace';

interface CellProps {
  weekIndex: number;
  dayOfWeek: number;
  rowIndex: number;
  /** The label of the row this cell sits in; a meal of another kind says so itself. */
  rowLabelKey: string;
  /** The day's meal in this row: what the cell drags, and what a drop on it addresses. */
  meal: EditorMeal | undefined;
  /** What the cell shows: the meal's own contents, or the contents sliding in while a move is previewed. */
  display: EditorMeal | undefined;
  selected: boolean;
  readOnly: boolean;
  /** What is being dragged over the grid, if a meal tile or a row or day label is. */
  drag: GridDragView | null;
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
  display,
  selected,
  readOnly,
  drag,
  detailOpen,
  detail,
  onSelect,
  onDetailClose,
  onKeyMove,
}: CellProps) {
  const { t } = useTranslation();
  const boundary = usePopoverBoundary();
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `cell:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { weekIndex, dayOfWeek, rowIndex },
    // Meal tiles and labels are dropped by position (see the editor), so no cell takes a drop while they are dragged.
    disabled: readOnly || drag !== null,
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
  const shownCount = display ? mealItemCount(display) : 0;
  const cellDrag = drag?.kind === 'cell' ? drag : null;
  const hovered = cellDrag?.hover?.dayOfWeek === dayOfWeek && cellDrag.hover.rowIndex === rowIndex;
  const landing = hovered && cellDrag?.mode === 'move';
  const dropMode = hovered && (cellDrag?.mode === 'copy' || cellDrag?.mode === 'swap') ? cellDrag.mode : undefined;
  let band: 'source' | 'target' | undefined;
  if (drag?.kind === 'label') {
    const own = drag.axis === 'row' ? rowIndex : dayOfWeek;
    band = own === drag.source ? 'source' : own === drag.target ? 'target' : undefined;
  }

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
          data-landing={landing ? 'true' : undefined}
          data-drop-target={dropMode}
          data-band={band}
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
            tileSurfaceClass(shownCount > 0),
            draggable &&
              'cursor-grab hover:-translate-y-px hover:shadow-raised-hover active:cursor-grabbing motion-reduce:hover:translate-y-0',
            selected && 'border-solid border-ink ring-2 ring-ink',
            // While the contents slide, this slot shows another meal's, so only a source that stays put is dimmed.
            isDragging && cellDrag?.mode !== 'move' && 'opacity-50',
            band === 'source' && 'opacity-50',
            band === 'target' && 'border-dashed border-nutrition bg-nutrition-soft shadow-none',
            dropMode === 'copy' && 'border-dashed border-nutrition bg-nutrition-soft shadow-none ring-0',
            dropMode === 'swap' && 'border-solid border-nutrition bg-nutrition-soft shadow-none ring-0',
            landing && 'border-solid border-nutrition ring-2 ring-nutrition',
            isDropTarget && !isDragging && 'border-dashed border-nutrition bg-nutrition-soft shadow-none ring-0',
          )}
        >
          <MealTileFace meal={display} rowLabelKey={rowLabelKey} flipKey={gridFaceKey(dayOfWeek, rowIndex)} />
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
  labelDrag?: { weekIndex: number; onKeyMove: (direction: -1 | 1) => void; over?: boolean };
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
      <LabelFrame
        axis="day"
        weekIndex={labelDrag.weekIndex}
        index={dayOfWeek}
        over={labelDrag.over}
        className={cn(rootClass, 'self-stretch')}
      >
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
  /** What is being dragged over the grid: a meal tile (with the contents already slid into place) or a label. */
  drag?: GridDragView | null;
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
  drag = null,
}: Props) {
  const { t } = useTranslation();
  const labelsDraggable = !readOnly && onLabelKeyMove !== undefined;
  const rows = weekRows(week);
  const dayByNumber = new Map(week.days.map((day) => [day.dayOfWeek, day]));
  // The slots stay the real week's; only what they show comes from the preview while a move is hovered.
  const shownDayByNumber = new Map((drag?.kind === 'cell' ? drag.week : week).days.map((day) => [day.dayOfWeek, day]));
  const labelTarget = (axis: LabelAxis) => (drag?.kind === 'label' && drag.axis === axis ? drag.target : null);

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
                ? {
                    weekIndex,
                    onKeyMove: (direction) => onLabelKeyMove?.('day', dayOfWeek, direction),
                    over: labelTarget('day') === dayOfWeek,
                  }
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
            <LabelFrame
              axis="row"
              weekIndex={weekIndex}
              index={row.index}
              over={labelTarget('row') === row.index}
              className={rowLabelClass}
            >
              {rowLabelContent}
            </LabelFrame>
          ) : (
            <span className={rowLabelClass}>{rowLabelContent}</span>
          )}
          {DAY_ORDER.map((dayOfWeek) => {
            const detailOpen = detailCell?.dayOfWeek === dayOfWeek && detailCell.rowIndex === row.index;
            const cellMeal = rowMeal(dayByNumber.get(dayOfWeek), row);
            return (
              <MealCell
                key={dayOfWeek}
                weekIndex={weekIndex}
                dayOfWeek={dayOfWeek}
                rowIndex={row.index}
                rowLabelKey={mealKindLabelKey(row.kind)}
                meal={cellMeal}
                display={rowMeal(shownDayByNumber.get(dayOfWeek), row)}
                selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === row.index}
                readOnly={readOnly}
                drag={drag}
                detailOpen={detailOpen}
                detail={detailOpen ? renderDetail({ dayOfWeek, rowIndex: row.index }) : null}
                onSelect={() => onSelect({ dayOfWeek, rowIndex: row.index })}
                onDetailClose={onDetailClose}
                onKeyMove={
                  onMoveMeal && cellMeal ? (direction) => onMoveMeal(dayOfWeek, cellMeal.mealId, direction) : undefined
                }
              />
            );
          })}
        </div>
        );
      })}
    </div>
    </div>
  );
}
