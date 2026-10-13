import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { PaletteKind } from '@/components/forms/builder/form-builder-model';

/** `type` of a palette tile's drag. */
export const PALETTE_DRAG = 'palette';
/** `type` of a question card's reorder drag. */
export const QUESTION_DRAG = 'question';
/** Droppable id of the whole question list, used for a drop below the last card or into an empty form. */
export const CANVAS_ID = 'form-canvas';

/** Mouse drags start after a short move; touch needs a press so the list can still scroll. */
export function dragActivationConstraints(event: PointerEvent) {
  return event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
    : [new PointerActivationConstraints.Distance({ value: 5 })];
}

/**
 * Palette tiles are buttons: pointer only, so Enter and Space still click (add) the tile. A press on the
 * tile's own text or icon must start the drag, so the default "interactive child" check is switched off.
 */
export const PALETTE_SENSORS = [
  PointerSensor.configure({ activationConstraints: dragActivationConstraints, preventActivation: () => false }),
];

export interface QuestionDragData {
  kind: 'question';
  key: string;
}

export interface OptionDragData {
  kind: 'option';
  questionKey: string;
  index: number;
}

export interface PaletteDragData {
  kind: 'palette';
  paletteKind: PaletteKind;
}

/** The type id used for the options of one choice question, so they only sort among themselves. */
export function optionDragType(questionKey: string): string {
  return `option:${questionKey}`;
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
}

export function readQuestionDrag(data: unknown): QuestionDragData | null {
  const record = asRecord(data);
  return record?.kind === 'question' && typeof record.key === 'string' ? { kind: 'question', key: record.key } : null;
}

export function readOptionDrag(data: unknown): OptionDragData | null {
  const record = asRecord(data);
  return record?.kind === 'option' && typeof record.questionKey === 'string' && typeof record.index === 'number'
    ? { kind: 'option', questionKey: record.questionKey, index: record.index }
    : null;
}

export function readPaletteDrag(data: unknown): PaletteDragData | null {
  const record = asRecord(data);
  const kind = record?.paletteKind;
  return record?.kind === 'palette' && typeof kind === 'string'
    ? { kind: 'palette', paletteKind: kind as PaletteKind }
    : null;
}

/** Moves one item of a list from `from` to `to`. */
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return next;
  }
  next.splice(to, 0, moved);
  return next;
}
