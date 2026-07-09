/**
 * Defensive parsing for `<input type="number">` onChange handlers used
 * across the training-plan builder (SetRow, WodExerciseRow,
 * SectionFormatConfigRow, SessionFormatBar, WorkoutDialog).
 *
 * Browsers do not reliably prevent invalid numeric input (a typed minus
 * sign, exponent notation, or a field cleared mid-edit) from reaching
 * `e.target.value`, so `Number(e.target.value)` can silently produce
 * `NaN` — and the HTML `min` attribute alone does not stop a negative
 * value from landing in component/store state. This helper centralizes
 * the guard so all five components clamp/reject the same way:
 *
 * - `''` (cleared field)       -> `null` — every caller in this codebase
 *   renders `null` as an unset/blank (`--`) cell.
 * - non-numeric / `NaN` input  -> `undefined` — the caller must skip the
 *   update entirely so the previous value is preserved (never let NaN
 *   propagate into state).
 * - a valid number below `min` -> clamped up to `min`.
 *
 * @param rawValue `e.target.value` from the number input
 * @param min the field's natural floor — `0` for fields that can
 *   legitimately be zero (weight/bodyweight, rest, "unlimited" rounds),
 *   `1` for fields where zero is meaningless (reps, duration, distance,
 *   intervals, required round counts)
 */
export function parseNumericInput(rawValue: string, min: number): number | null | undefined {
  if (rawValue === '') return null;
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(min, parsed);
}
