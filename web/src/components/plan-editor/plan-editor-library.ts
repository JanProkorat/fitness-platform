import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { FoodSummary, RecipeSummaryDto } from '@/api/generated';
import {
  columnMovePlacement,
  daySlots,
  gapForSlot,
  labelMovePlacement,
  moveLabel,
  moveMealAlongRow,
  moveMealContents,
  rowMeal,
  rowMovePlacement,
  weekRows,
  type CellFlip,
  type CellRef,
  type LabelAxis,
} from '@/components/plan-editor/plan-editor-ops';
import type {
  EditorDocument,
  EditorFood,
  EditorMeal,
  EditorWeek,
  LibraryItem,
} from '@/components/plan-editor/plan-editor-types';
import { perServing } from '@/lib/recipe-nutrition';

const DEFAULT_AMOUNT_GRAMS = 100;

/** `data.type` of a meal card's drag, in both the week grid and the Day view. */
export const CELL_MEAL_DRAG = 'cell-meal';

export interface CellMealDrag {
  weekIndex: number;
  dayOfWeek: number;
  /** The meal's row in the week grid (kind and occurrence), in both the Week and the Day view. */
  rowIndex: number;
  mealId: string;
}

/** The source of a week-grid card drag, or null for any other drag. */
export function readCellMealDrag(data: unknown): CellMealDrag | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { type, weekIndex, dayOfWeek, rowIndex, mealId } = data as Record<string, unknown>;
  return type === CELL_MEAL_DRAG &&
    typeof weekIndex === 'number' &&
    typeof dayOfWeek === 'number' &&
    typeof rowIndex === 'number' &&
    typeof mealId === 'string'
    ? { weekIndex, dayOfWeek, rowIndex, mealId }
    : null;
}

/** The `aria-keyshortcuts` of a meal card that can move up and down its day. */
export const MOVE_KEY_SHORTCUTS = 'Alt+ArrowUp Alt+ArrowDown';

/** The `aria-keyshortcuts` of a week-grid tile, which can also move along its row. */
export const GRID_MOVE_KEY_SHORTCUTS = 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight';

/**
 * -1 for Alt+ArrowUp, 1 for Alt+ArrowDown pressed on the element itself (not on a field inside it), else null.
 * Other modifiers are left alone.
 */
export function moveDirection(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget;
  currentTarget: EventTarget;
}): -1 | 1 | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target !== event.currentTarget) {
    return null;
  }
  return event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null;
}

/** `data.type` of a meal row's label dragged in the week grid. */
export const ROW_LABEL_DRAG = 'row-label';

/** `data.type` of a weekday's label dragged in the week grid. */
export const DAY_LABEL_DRAG = 'day-label';

export interface RowLabelRef {
  weekIndex: number;
  rowIndex: number;
}

export interface DayLabelRef {
  weekIndex: number;
  dayOfWeek: number;
}

/** The row label a drag data points at, or null for any other data. */
export function readRowLabel(data: unknown, type: typeof ROW_LABEL_DRAG): RowLabelRef | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  return candidate['type'] === type && typeof candidate['weekIndex'] === 'number' && typeof candidate['rowIndex'] === 'number'
    ? { weekIndex: candidate['weekIndex'], rowIndex: candidate['rowIndex'] }
    : null;
}

/** The day label a drag data points at, or null for any other data. */
export function readDayLabel(data: unknown, type: typeof DAY_LABEL_DRAG): DayLabelRef | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  return candidate['type'] === type && typeof candidate['weekIndex'] === 'number' && typeof candidate['dayOfWeek'] === 'number'
    ? { weekIndex: candidate['weekIndex'], dayOfWeek: candidate['dayOfWeek'] }
    : null;
}

/** True while the dragged thing is a row or a day label. */
export function isLabelDrag(data: unknown): boolean {
  return readRowLabel(data, ROW_LABEL_DRAG) !== null || readDayLabel(data, DAY_LABEL_DRAG) !== null;
}

/** The `aria-keyshortcuts` of a row label and of a day label. */
export const ROW_LABEL_KEY_SHORTCUTS = 'Alt+ArrowUp Alt+ArrowDown';
export const DAY_LABEL_KEY_SHORTCUTS = 'Alt+ArrowLeft Alt+ArrowRight';

/** -1 for Alt+ArrowLeft, 1 for Alt+ArrowRight pressed on the element itself, else null. Other modifiers are left alone. */
export function sideDirection(event: Parameters<typeof moveDirection>[0]): -1 | 1 | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target !== event.currentTarget) {
    return null;
  }
  return event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null;
}

/** `data.type` of a recipe or ingredient row dragged within its own list of a meal. */
export const MEAL_ITEM_DRAG = 'meal-item';

export interface MealItemDrag {
  weekIndex: number;
  dayOfWeek: number;
  mealId: string;
  kind: 'recipe' | 'food';
  index: number;
}

/** The source of a meal-item reorder drag, or null for any other drag. */
export function readMealItemDrag(data: unknown): MealItemDrag | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { type, weekIndex, dayOfWeek, mealId, kind, index } = data as Record<string, unknown>;
  return type === MEAL_ITEM_DRAG &&
    typeof weekIndex === 'number' &&
    typeof dayOfWeek === 'number' &&
    typeof mealId === 'string' &&
    (kind === 'recipe' || kind === 'food') &&
    typeof index === 'number'
    ? { weekIndex, dayOfWeek, mealId, kind, index }
    : null;
}

/** Whole-card drags: a short mouse move starts one, touch needs a press so the list still scrolls. */
export function dragActivationConstraints(event: PointerEvent) {
  return event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
    : [new PointerActivationConstraints.Distance({ value: 5 })];
}

/** Day-view meal cards: the whole card drags, but inputs, buttons and `data-no-drag` parts do not start one. */
export const MEAL_CARD_SENSORS = [
  PointerSensor.configure({
    activationConstraints: dragActivationConstraints,
    preventActivation: (event) =>
      event.target instanceof Element &&
      event.target.closest('input, textarea, select, button, a, [data-no-drag]') !== null,
  }),
];

/** Library cards: the whole card drags, except children marked `data-no-drag` (the add button). */
export const LIBRARY_CARD_SENSORS = [
  PointerSensor.configure({
    activationConstraints: dragActivationConstraints,
    preventActivation: (event) => event.target instanceof Element && event.target.closest('[data-no-drag]') !== null,
  }),
];

/**
 * Week-grid cells: pointer only, so Enter and Space on a focused cell keep opening the meal. The cell
 * is itself a button, so a press on its text must not count as one on an interactive child.
 */
export const GRID_CELL_SENSORS = [
  PointerSensor.configure({ activationConstraints: dragActivationConstraints, preventActivation: () => false }),
];

/** Row and day labels: pointer only, so a focused label never starts a keyboard drag; Alt+Arrow moves it instead. */
export const LABEL_SENSORS = GRID_CELL_SENSORS;

/** A library recipe as a one-serving plan item (values divided by the recipe's servings). */
export function recipeToItem(recipe: RecipeSummaryDto): LibraryItem {
  const macros = perServing(recipe.totalNutrients, recipe.servings);
  return {
    type: 'recipe',
    recipe: {
      recipeId: recipe.recipeId ?? '',
      recipeName: recipe.name ?? '',
      nutrientValuePerServing: {
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
      },
      servings: 1,
      foodCategories: recipe.foodCategories,
    },
  };
}

/** A library ingredient as a plan item, in its first common serving (100 g when it has none). */
export function foodToItem(food: FoodSummary): LibraryItem {
  const amountGrams = food.commonServings?.[0]?.weightGrams ?? DEFAULT_AMOUNT_GRAMS;
  return {
    type: 'food',
    food: {
      foodExternalId: food.foodId ?? '',
      foodName: food.rawName ?? food.name ?? '',
      foodNameCs: food.nameCs,
      foodNameEn: food.nameEn,
      foodNameDe: food.nameDe,
      foodCategory: food.category,
      nutrientValuePer100Grams: { ...food.nutrientValue },
      amountGrams: amountGrams > 0 ? amountGrams : DEFAULT_AMOUNT_GRAMS,
    },
  };
}

/** The ingredient's name in the UI language, falling back to the stored name. */
export function foodDisplayName(food: EditorFood, language: string): string {
  const localized =
    language.startsWith('cs') ? food.foodNameCs : language.startsWith('de') ? food.foodNameDe : food.foodNameEn;
  return localized || food.foodName;
}

/** The label of a meal's first item, with the rest as a count, for a grid cell. */
export function mealItemNames(meal: EditorMeal, language: string): string[] {
  return [
    ...meal.recipes.map((recipe) => recipe.recipeName),
    ...meal.foods.map((food) => foodDisplayName(food, language)),
  ];
}

/** The key a tile's face carries in the week grid, so the grid can slide it from one cell to another. */
export function gridFaceKey(dayOfWeek: number, rowIndex: number): string {
  return `${dayOfWeek}:${rowIndex}`;
}

/** What dropping the dragged meal on the hovered cell does: slide the contents into that slot, or copy it there. */
export type CellDropMode = 'move' | 'copy';

/** What the grid shows while a meal tile is dragged. */
export interface CellDragView {
  kind: 'cell';
  source: CellMealDrag;
  hover: CellRef | null;
  mode: CellDropMode | null;
  /** Alt/Option is held: the drop copies instead of moving. */
  alt: boolean;
  /** The week with the dragged contents already slid into place while `mode` is `move`; otherwise the week itself. */
  week: EditorWeek;
  /** Where the contents shown in `week` came from, for the cells that slid. */
  moves: CellFlip[];
}

/** A tile of a dragged row or column, positioned relative to the label that is dragged. */
export interface LabelTile extends CellRef {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** What the grid shows while a row or day label is dragged. */
export interface LabelDragView {
  kind: 'label';
  axis: LabelAxis;
  /** The row index of the dragged row, the weekday of the dragged day. */
  source: number;
  /** The hovered row or day, or null when none (or the dragged one) is hovered. */
  target: number | null;
  tiles: LabelTile[];
  /** Alt/Option is held: the drop copies instead of moving. */
  alt: boolean;
  /** `move` while the hovered target takes the contents by sliding them, `copy` while Alt is held over one. */
  mode: CellDropMode | null;
  /** The week with the moved contents already in place while `mode` is `move`; otherwise the week itself. */
  week: EditorWeek;
  /** Where the contents shown in `week` came from, for the cells that slid. */
  moves: CellFlip[];
}

export type GridDragView = CellDragView | LabelDragView;

/**
 * How dropping the meal on the hovered cell is handled. A plain drop on a meal of the source's own day or row
 * slides the contents there; a held Alt, a cell the day has no meal for, and every other cell copy.
 */
export function cellDropMode(
  week: EditorWeek,
  source: CellMealDrag,
  hover: CellRef | null,
  alt: boolean,
): CellDropMode | null {
  if (!hover) {
    return null;
  }
  const row = weekRows(week)[hover.rowIndex];
  const target = rowMeal(
    week.days.find((day) => day.dayOfWeek === hover.dayOfWeek),
    row,
  );
  if (!row || target?.mealId === source.mealId) {
    return null;
  }
  if (alt || !target) {
    return 'copy';
  }
  return hover.dayOfWeek === source.dayOfWeek || hover.rowIndex === source.rowIndex ? 'move' : 'copy';
}

/** The gap a plain drop on `hover` stands for within the source's own day, or null when the day has no such pair of slots. */
function dayGap(week: EditorWeek, source: CellMealDrag, hover: CellRef): number | null {
  const slots = daySlots(week.days.find((day) => day.dayOfWeek === source.dayOfWeek));
  const target = rowMeal(
    week.days.find((day) => day.dayOfWeek === hover.dayOfWeek),
    weekRows(week)[hover.rowIndex],
  );
  const from = slots.findIndex((meal) => meal.mealId === source.mealId);
  const to = slots.findIndex((meal) => meal.mealId === target?.mealId);
  return from === -1 || to === -1 ? null : gapForSlot(from, to);
}

/** Where the contents of the dragged meal go when a plain drop lands on `hover`. */
function cellMovePlacement(week: EditorWeek, source: CellMealDrag, hover: CellRef): CellFlip[] {
  if (hover.dayOfWeek === source.dayOfWeek) {
    const gap = dayGap(week, source, hover);
    return gap === null ? [] : columnMovePlacement(week, source.dayOfWeek, source.mealId, gap);
  }
  return rowMovePlacement(week, hover.rowIndex, source.dayOfWeek, hover.dayOfWeek);
}

/** The document after a plain drop of the dragged meal on `hover`; the one function the preview and the drop share. */
export function moveCellContents(doc: EditorDocument, weekIndex: number, source: CellMealDrag, hover: CellRef): EditorDocument {
  const week = doc.weeks[weekIndex];
  if (!week) {
    return doc;
  }
  if (hover.dayOfWeek === source.dayOfWeek) {
    const gap = dayGap(week, source, hover);
    return gap === null ? doc : moveMealContents(doc, weekIndex, source.dayOfWeek, source.mealId, gap);
  }
  return moveMealAlongRow(doc, weekIndex, hover.rowIndex, source.dayOfWeek, hover.dayOfWeek);
}

/** The drag view for the pointer over `hover`, with the contents already moved when the drop would move them. */
export function cellDragView(
  doc: EditorDocument,
  weekIndex: number,
  source: CellMealDrag,
  hover: CellRef | null,
  alt: boolean,
): CellDragView {
  const week = doc.weeks[weekIndex] ?? { weekNumber: 0, days: [] };
  const mode = cellDropMode(week, source, hover, alt);
  if (!hover || mode !== 'move') {
    return { kind: 'cell', source, hover, mode, alt, week, moves: [] };
  }
  const moves = cellMovePlacement(week, source, hover);
  if (moves.length === 0) {
    return { kind: 'cell', source, hover, mode: null, alt, week, moves: [] };
  }
  const moved = moveCellContents(doc, weekIndex, source, hover);
  return { kind: 'cell', source, hover, mode, alt, week: moved.weeks[weekIndex] ?? week, moves };
}

/** What a label drag starts from: which label, and the tiles lifted with it. */
export type LabelDragBase = Pick<LabelDragView, 'axis' | 'source' | 'tiles'>;

/** The drag view for the pointer over `target`, with the contents already moved when the drop would move them. */
export function labelDragView(
  doc: EditorDocument,
  weekIndex: number,
  base: LabelDragBase,
  target: number | null,
  alt: boolean,
): LabelDragView {
  const week = doc.weeks[weekIndex] ?? { weekNumber: 0, days: [] };
  if (target === null) {
    return { kind: 'label', ...base, target, alt, mode: null, week, moves: [] };
  }
  if (alt) {
    return { kind: 'label', ...base, target, alt, mode: 'copy', week, moves: [] };
  }
  const move = { axis: base.axis, from: base.source, to: target };
  const moved = moveLabel(doc, weekIndex, move);
  return {
    kind: 'label',
    ...base,
    target,
    alt,
    mode: 'move',
    week: moved.weeks[weekIndex] ?? week,
    moves: labelMovePlacement(week, move),
  };
}

/** A rectangle measured when a drag started, in client coordinates at that moment. */
export interface FrozenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FrozenCell extends FrozenRect, CellRef {}

export interface FrozenBand extends FrozenRect {
  /** The row index of a row band, the weekday of a day band. */
  index: number;
}

function distanceToRect(rect: FrozenRect, x: number, y: number): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

function insideUnion(rects: readonly FrozenRect[], x: number, y: number): boolean {
  return (
    rects.length > 0 &&
    x >= Math.min(...rects.map((rect) => rect.left)) &&
    x <= Math.max(...rects.map((rect) => rect.right)) &&
    y >= Math.min(...rects.map((rect) => rect.top)) &&
    y <= Math.max(...rects.map((rect) => rect.bottom))
  );
}

/** The cell nearest the point, as long as the point is inside the area the cells span; the gaps between cells pick their neighbour. */
export function hitCell(cells: readonly FrozenCell[], x: number, y: number): CellRef | null {
  if (!insideUnion(cells, x, y)) {
    return null;
  }
  let best: FrozenCell | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    const distance = distanceToRect(cell, x, y);
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
    }
  }
  return best ? { dayOfWeek: best.dayOfWeek, rowIndex: best.rowIndex } : null;
}

interface Span {
  start: number;
  end: number;
}

/** Each row's (axis `row`, by y) or day's (axis `day`, by x) extent across its cells. */
function axisSpans(cells: readonly FrozenCell[], axis: LabelAxis): Map<number, Span> {
  const spans = new Map<number, Span>();
  for (const cell of cells) {
    const index = axis === 'row' ? cell.rowIndex : cell.dayOfWeek;
    const start = axis === 'row' ? cell.top : cell.left;
    const end = axis === 'row' ? cell.bottom : cell.right;
    const span = spans.get(index);
    spans.set(index, span ? { start: Math.min(span.start, start), end: Math.max(span.end, end) } : { start, end });
  }
  return spans;
}

/** The span of `index` stretched halfway into the gaps to its neighbours, so the bands of all indexes meet without a gap. */
function bandSpan(spans: ReadonlyMap<number, Span>, index: number): Span | null {
  const own = spans.get(index);
  if (!own) {
    return null;
  }
  const others = [...spans.values()];
  const before = others.filter((span) => span.end <= own.start).map((span) => span.end);
  const after = others.filter((span) => span.start >= own.end).map((span) => span.start);
  return {
    start: before.length > 0 ? (Math.max(...before) + own.start) / 2 : own.start,
    end: after.length > 0 ? (own.end + Math.min(...after)) / 2 : own.end,
  };
}

/** The index whose span is nearest the value. */
function nearestSpan(spans: ReadonlyMap<number, Span>, value: number): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, span] of spans) {
    const distance = Math.max(span.start - value, 0, value - span.end);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The hovered cell for a tile dragged from `source`, with the axes locked on the frozen layout: while the pointer
 * is inside the source row's band the hovered row is the source row, and likewise the source day inside the
 * source day's band, so a drag along one axis never drifts onto a neighbouring row or day. Only outside both
 * bands does the cell under the pointer decide (a diagonal drop).
 */
export function hitCellLocked(cells: readonly FrozenCell[], source: CellRef, x: number, y: number): CellRef | null {
  const hit = hitCell(cells, x, y);
  if (!hit) {
    return null;
  }
  const rowSpans = axisSpans(cells, 'row');
  const daySpans = axisSpans(cells, 'day');
  const rowBand = bandSpan(rowSpans, source.rowIndex);
  const dayBand = bandSpan(daySpans, source.dayOfWeek);
  const inRow = rowBand !== null && y >= rowBand.start && y <= rowBand.end;
  const inDay = dayBand !== null && x >= dayBand.start && x <= dayBand.end;
  if (inRow && inDay) {
    return { dayOfWeek: source.dayOfWeek, rowIndex: source.rowIndex };
  }
  if (inRow) {
    const dayOfWeek = nearestSpan(daySpans, x);
    return dayOfWeek === null ? hit : { dayOfWeek, rowIndex: source.rowIndex };
  }
  if (inDay) {
    const rowIndex = nearestSpan(rowSpans, y);
    return rowIndex === null ? hit : { dayOfWeek: source.dayOfWeek, rowIndex };
  }
  return hit;
}

/** The row (by y) or day (by x) band the point is in; a point anywhere along a band picks it, the gaps between bands the nearer one. */
export function hitBand(bands: readonly FrozenBand[], axis: LabelAxis, x: number, y: number): number | null {
  if (!insideUnion(bands, x, y)) {
    return null;
  }
  let best: FrozenBand | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const band of bands) {
    const distance =
      axis === 'row' ? Math.max(band.top - y, 0, y - band.bottom) : Math.max(band.left - x, 0, x - band.right);
    if (distance < bestDistance) {
      best = band;
      bestDistance = distance;
    }
  }
  return best ? best.index : null;
}

/** The look of a week-grid tile: a raised card when it holds food, a dashed outline when it does not. */
export function tileSurfaceClass(filled: boolean): string {
  return filled ? 'border-raised-line bg-raised shadow-raised' : 'border-dashed border-line bg-transparent';
}
