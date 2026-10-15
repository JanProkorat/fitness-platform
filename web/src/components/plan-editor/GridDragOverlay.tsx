import { cn } from '@/lib/utils';
import MealTileFace from '@/components/plan-editor/MealTileFace';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { tileSurfaceClass, type LabelDragView } from '@/components/plan-editor/plan-editor-library';
import { rowMeal, weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { EditorWeek } from '@/components/plan-editor/plan-editor-types';

interface Props {
  view: LabelDragView;
  week: EditorWeek;
}

/**
 * The dragged row or column, lifted off the grid: a copy of each of its tiles at the size and place it had when
 * the drag started, measured from the label that is dragged. Built from presentational faces only, so it adds no
 * drop targets of its own.
 */
export default function GridDragOverlay({ view, week }: Props) {
  const rows = weekRows(week);
  return (
    <div data-testid="grid-drag-overlay" data-axis={view.axis} className="pointer-events-none relative">
      {view.tiles.map((tile) => {
        const row = rows[tile.rowIndex];
        const meal = rowMeal(
          week.days.find((day) => day.dayOfWeek === tile.dayOfWeek),
          row,
        );
        const filled = meal !== undefined && meal.foods.length + meal.recipes.length > 0;
        return (
          <div
            key={`${tile.dayOfWeek}:${tile.rowIndex}`}
            style={{ left: tile.left, top: tile.top, width: tile.width, height: tile.height }}
            className={cn(
              'absolute flex flex-col items-stretch rounded-xl border p-3 shadow-popover',
              tileSurfaceClass(filled),
              !filled && 'bg-grid',
            )}
          >
            <MealTileFace meal={meal} rowLabelKey={row ? mealKindLabelKey(row.kind) : ''} />
          </div>
        );
      })}
    </div>
  );
}
