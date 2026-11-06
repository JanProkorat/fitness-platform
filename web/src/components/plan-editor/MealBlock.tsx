import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { Check, CircleAlert, Contrast, GripVertical, History, Lock, StickyNote, Trash2, X } from 'lucide-react';
import { MealLockState } from '@/api/generated';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MacroDots from '@/components/plan-editor/MacroDots';
import MealItemRow from '@/components/plan-editor/MealItemRow';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import {
  CELL_MEAL_DRAG,
  MEAL_CARD_SENSORS,
  MOVE_KEY_SHORTCUTS,
  moveDirection,
  type GridDragView,
} from '@/components/plan-editor/plan-editor-library';
import {
  mealDayShareStatus,
  mealItemCount,
  mealItemEntries,
  mealTotals,
  type ShareStatus,
} from '@/components/plan-editor/plan-editor-nutrition';
import {
  removeFoodAt,
  removeMeal,
  removeRecipeAt,
  setFoodAmount,
  setMealNote,
  setRecipeServings,
} from '@/components/plan-editor/plan-editor-ops';
import LockedMealPopover from '@/components/plan-editor/LockedMealPopover';
import { usePopoverBoundary } from '@/components/plan-editor/PopoverBoundary';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  isPastDay,
  isRejectedTile,
  lockedTileSurfaceClass,
  mealLockView,
  slotDate,
  snapshotEntries,
  sumEntries,
  useLockConflicts,
  useLockRejection,
  useMealLocks,
  useRestoreRejected,
} from '@/components/plan-editor/meal-locks';
import SyncConflictDayPanel from '@/components/plan-editor/sync-conflicts/SyncConflictDayPanel';
import { useSyncConflicts } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import { MAX_NOTE_LENGTH, type EditorMeal } from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

const STATE_CHIP_CLASS: Record<MealLockState, string> = {
  [MealLockState.Open]: '',
  [MealLockState.Eaten]: 'text-success-ink',
  [MealLockState.PartlyEaten]: 'text-caution-ink',
  [MealLockState.Missed]: 'text-error',
};

const SHARE_CHIP_CLASS: Record<ShareStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  on: 'bg-success-soft text-success-ink',
  over: 'bg-training-soft text-training-ink',
  under: 'bg-muted text-muted-foreground',
};

interface Props {
  /** The day's meal in this slot: what the card drags, and what a drop on it addresses. */
  meal: EditorMeal;
  /** What the card shows: the meal's own contents, or the contents sliding in while a move is previewed. */
  display?: EditorMeal;
  /** What is being dragged over the day: a meal card, with the contents already slid into place. */
  drag?: GridDragView | null;
  /** The meal's row in the week grid; drops and drags address it by this, not by its position in the day. */
  rowIndex: number;
  /** The insert line above the card, rendered inside it so it can fill the gap. */
  insertLine?: ReactNode;
  /** Alt+ArrowUp / Alt+ArrowDown on the focused card: moves its contents one meal up or down the day. */
  onKeyMove?: (direction: -1 | 1) => void;
  weekIndex: number;
  dayOfWeek: number;
  dayKcal: number;
  readOnly: boolean;
  selected: boolean;
  language: string;
  onSelect: () => void;
  onEdit: PlanEditorState['edit'];
}

/** One meal of the day: draggable by its whole card onto another meal to copy it, with its items, note and delete. */
export default function MealBlock({
  meal,
  display,
  drag = null,
  rowIndex,
  insertLine,
  onKeyMove,
  weekIndex,
  dayOfWeek,
  dayKcal,
  readOnly,
  selected,
  language,
  onSelect,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const conflicts = useSyncConflicts();
  const conflict = conflicts?.forMeal(weekIndex, meal.mealId);
  const locks = useMealLocks();
  const conflictKind = useLockConflicts().get(meal.mealId);
  const flagged = conflictKind !== undefined;
  const serverRejected = isRejectedTile(useLockRejection(), meal.mealId, weekIndex + 1, dayOfWeek);
  const rejected = flagged || serverRejected;
  const restore = useRestoreRejected();
  const boundary = usePopoverBoundary();
  const [conflictOpen, setConflictOpen] = useState(false);
  // A locked meal reads like a read-only one: it neither moves nor takes a drop, and its controls are gone.
  const lockView = locks ? mealLockView(locks, meal.mealId, weekIndex + 1, dayOfWeek) : undefined;
  const locked = lockView?.locked ?? false;
  const info = lockView?.info;
  const frozen = readOnly || locked;
  const draggable = !frozen && mealItemCount(meal) > 0;
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `cell:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { weekIndex, dayOfWeek, rowIndex },
    // A meal card is dropped by position (see the editor), so no card takes a drop while one is dragged.
    disabled: frozen || drag !== null,
  });
  const { ref: dragRef, isDragging } = useDraggable({
    id: `cell-meal:${weekIndex}:${dayOfWeek}:${rowIndex}`,
    data: { type: CELL_MEAL_DRAG, weekIndex, dayOfWeek, rowIndex, mealId: meal.mealId },
    disabled: !draggable,
    sensors: MEAL_CARD_SENSORS,
  });
  // The drag library only gets the element while the card can be dragged, so it never marks another one aria-disabled.
  const ref = useCallback(
    (element: Element | null) => {
      dropRef(element);
      dragRef(draggable ? element : null);
    },
    [dropRef, dragRef, draggable],
  );
  const shown = display ?? meal;
  // A locked meal shows what the client ate (its snapshot); without one, the meal's own items.
  const lockedRows = locked
    ? info && info.snapshot.length > 0
      ? snapshotEntries(info.snapshot, info.eatenItemIds)
      : mealItemEntries(shown, language).map((entry) => {
          const itemId = entry.type === 'recipe' ? shown.recipes[entry.index]?.itemId : shown.foods[entry.index]?.itemId;
          return {
            entry,
            eaten: itemId !== undefined && (info?.eatenItemIds ?? []).includes(itemId),
            sourceId: entry.type === 'recipe' ? shown.recipes[entry.index]?.recipeId : shown.foods[entry.index]?.foodExternalId,
          };
        })
    : null;
  const totals = lockedRows ? sumEntries(lockedRows) : mealTotals(shown);
  const entries = lockedRows ? lockedRows.map((row) => row.entry) : mealItemEntries(shown, language);
  const lockState = lockView?.state ?? MealLockState.Open;
  const StateIcon = lockState === MealLockState.Eaten ? Check : lockState === MealLockState.PartlyEaten ? Contrast : X;
  const eatenCount = lockedRows ? lockedRows.filter((row) => row.eaten).length : 0;
  const eatenTime =
    lockState === MealLockState.Eaten && info?.eatenAt
      ? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(info.eatenAt))
      : null;
  const share = mealDayShareStatus(totals.kcal, dayKcal, shown.kind);
  const kindLabel = t(`planEditor.rows.${mealKindLabelKey(shown.kind)}`);
  const cellDrag = drag?.kind === 'cell' ? drag : null;
  const hovered = cellDrag?.hover?.dayOfWeek === dayOfWeek && cellDrag.hover.rowIndex === rowIndex;
  const landing = hovered && cellDrag?.mode === 'move';
  const dropMode = hovered && cellDrag?.mode === 'copy' ? 'copy' : undefined;

  return (
    <Popover open={conflictOpen} modal={false} onOpenChange={setConflictOpen}>
    <PopoverAnchor asChild>
    <li
      ref={ref}
      data-testid="meal-block"
      data-meal-id={meal.mealId}
      data-day={dayOfWeek}
      data-row={rowIndex}
      data-landing={landing ? 'true' : undefined}
      data-drop-target={dropMode}
      data-conflict={conflict ? conflict.id : undefined}
      data-lock-rejected={rejected ? 'true' : undefined}
      data-lock={locked ? lockState : undefined}
      tabIndex={readOnly ? undefined : 0}
      aria-label={kindLabel}
      onClick={() => {
        onSelect();
        if (flagged) {
          setConflictOpen((open) => !open);
        }
      }}
      aria-keyshortcuts={draggable && onKeyMove ? MOVE_KEY_SHORTCUTS : undefined}
      onKeyDown={(event) => {
        const direction = draggable && onKeyMove ? moveDirection(event) : null;
        if (direction) {
          event.preventDefault();
          onKeyMove?.(direction);
        }
      }}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-raised-line bg-raised p-5 shadow-raised outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50',
        draggable && !isDragging && 'hover:-translate-y-px hover:shadow-raised-hover motion-reduce:hover:translate-y-0',
        locked && lockedTileSurfaceClass(lockState),
        conflict && 'border-caution-ink bg-caution-soft',
        selected && 'ring-2 ring-ink ring-inset',
        rejected && 'border-error ring-2 ring-error ring-inset',
        isDropTarget && !isDragging && 'border-nutrition bg-nutrition-soft',
        dropMode !== undefined && 'border-dashed border-nutrition bg-nutrition-soft',
        landing && 'border-nutrition ring-2 ring-nutrition',
        // While the contents slide, this slot shows another meal's, so only a source that stays put is dimmed.
        isDragging && cellDrag?.mode !== 'move' && 'opacity-60 shadow-selection-bar',
      )}
    >
      {insertLine}
      <div data-flip-key={meal.mealId} className="relative flex flex-col gap-3">
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', draggable && 'cursor-grab active:cursor-grabbing')}>
          {draggable && <GripVertical className="size-4 shrink-0 text-faint" aria-hidden="true" />}
          {locked && !flagged && (
            <Lock data-testid="meal-lock-icon" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {flagged && (
            <button
              type="button"
              data-testid="meal-lock-conflict"
              aria-label={t('planEditor.locks.conflictBadge')}
              title={t('planEditor.locks.conflictBadge')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setConflictOpen((open) => !open);
              }}
              className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-error text-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CircleAlert className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <h3 className="font-display text-card-title font-semibold text-ink">{kindLabel}</h3>
          <span className="text-copy font-semibold text-ink">
            {t('planEditor.cell.kcal', { kcal: Math.round(totals.kcal) })}
          </span>
          <span data-testid="meal-macros" className="text-body text-muted-foreground">
            <MacroDots protein={totals.protein} carbs={totals.carbs} fat={totals.fat} fiber={totals.fiber} unit />
          </span>
          {dayKcal > 0 && (
            <span
              data-testid="meal-share"
              data-status={share.status}
              className={cn('rounded-full px-2.5 py-1 text-meta font-semibold', SHARE_CHIP_CLASS[share.status])}
            >
              {t('planEditor.day.percentOfDay', { percent: Math.round((totals.kcal / dayKcal) * 100) })}
            </span>
          )}
          {locked && lockState !== MealLockState.Open && (
            <span
              data-testid="meal-lock-chip"
              data-state={lockState}
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-card/70 px-2.5 py-1 text-meta font-semibold',
                STATE_CHIP_CLASS[lockState],
              )}
            >
              <StateIcon className="size-3" aria-hidden="true" />
              {lockState === MealLockState.Eaten
                ? t('planEditor.locks.state.eaten')
                : lockState === MealLockState.PartlyEaten
                  ? t('planEditor.locks.state.partly', { eaten: eatenCount, total: entries.length })
                  : t('planEditor.locks.state.missed')}
            </span>
          )}
          {conflict && (
            <span
              data-testid="meal-conflict-chip"
              className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2.5 py-1 text-meta font-semibold text-caution-ink"
            >
              <History className="size-3" aria-hidden="true" />
              {t('planEditor.locks.planChangedLater')}
            </span>
          )}
          {locked && (eatenTime || lockState === MealLockState.Missed) && (
            <span data-testid="meal-eaten-at" className="ml-auto text-body text-muted-foreground">
              {lockState === MealLockState.Missed
                ? t('planEditor.locks.notMarkedEaten')
                : t(conflict ? 'planEditor.locks.eatenAtOffline' : 'planEditor.locks.eatenAt', { time: eatenTime })}
            </span>
          )}
          {!frozen && (
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label={t('planEditor.day.removeMeal', { meal: kindLabel })}
                title={t('planEditor.day.removeMeal', { meal: kindLabel })}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit((doc) => removeMeal(doc, weekIndex, dayOfWeek, meal.mealId));
                }}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-error focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>

        {entries.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {entries.map((entry, position) => (
              <MealItemRow
                key={`${entry.type}:${entry.index}`}
                entry={entry}
                readOnly={frozen}
                variant="day"
                position={{ weekIndex, dayOfWeek, mealId: meal.mealId }}
                eatenMark={lockedRows ? lockedRows[position].eaten : undefined}
                sourceId={
                  lockedRows
                    ? lockedRows[position].sourceId
                    : entry.type === 'recipe'
                      ? shown.recipes[entry.index]?.recipeId
                      : shown.foods[entry.index]?.foodExternalId
                }
                onAmount={(value) =>
                  onEdit(
                    (doc) =>
                      entry.type === 'recipe'
                        ? setRecipeServings(doc, weekIndex, dayOfWeek, meal.mealId, entry.index, value)
                        : setFoodAmount(doc, weekIndex, dayOfWeek, meal.mealId, entry.index, value),
                    `amount:${meal.mealId}:${entry.type}:${entry.index}`,
                  )
                }
                onRemove={() =>
                  onEdit((doc) =>
                    entry.type === 'recipe'
                      ? removeRecipeAt(doc, weekIndex, dayOfWeek, meal.mealId, entry.index)
                      : removeFoodAt(doc, weekIndex, dayOfWeek, meal.mealId, entry.index),
                  )
                }
              />
            ))}
          </ul>
        ) : (
          !frozen && (
            <p className="rounded-xl border border-dashed border-line px-4 py-3 text-body text-muted-foreground">
              {t('planEditor.day.emptyMeal')}
            </p>
          )
        )}

        {/* Below the eaten rows: the card shows what was eaten first, then the notice about the later change. */}
        {conflict && conflicts && <SyncConflictDayPanel placed={conflict} model={conflicts} eaten={info} />}

        {frozen ? (
          shown.note && (
            <p className="flex items-center gap-2 text-body text-ink">
              <StickyNote className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {shown.note}
            </p>
          )
        ) : (
          <div className="relative">
            <StickyNote
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={shown.note ?? ''}
              maxLength={MAX_NOTE_LENGTH}
              aria-label={t('planEditor.day.mealNoteLabel', { meal: kindLabel })}
              placeholder={t('planEditor.day.notePlaceholder')}
              onChange={(event) =>
                onEdit((doc) => setMealNote(doc, weekIndex, dayOfWeek, meal.mealId, event.target.value), `note:${meal.mealId}`)
              }
              className="h-10 pl-10"
            />
          </div>
        )}
      </div>
    </li>
    </PopoverAnchor>
    {conflictOpen && flagged && locks && lockView && (
      <PopoverContent
        side="bottom"
        align="start"
        collisionBoundary={boundary}
        collisionPadding={{ top: 0, right: 16, bottom: 16, left: 16 }}
        sideOffset={8}
        data-testid="meal-detail"
        className="max-h-(--radix-popover-content-available-height) w-140 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-line bg-card p-5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <LockedMealPopover
          meal={meal}
          lock={lockView}
          clientName={locks.clientName}
          dayOfWeek={dayOfWeek}
          date={slotDate(locks.startDate, weekIndex + 1, dayOfWeek)}
          pastDay={isPastDay(locks, weekIndex + 1, dayOfWeek)}
          language={language}
          conflict={conflictKind}
          onClose={() => setConflictOpen(false)}
          onRestore={
            restore
              ? () => {
                  restore(meal.mealId);
                  setConflictOpen(false);
                }
              : undefined
          }
        />
      </PopoverContent>
    )}
    </Popover>
  );
}
