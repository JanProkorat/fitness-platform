import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrainingSection, WorkoutFormat, MovementType, SessionExecutionDto } from '@/api/training-plan-types';
import type { MuscleGroup } from '@/api/exercise-types';
import { ExerciseSearch } from '@/components/training/ExerciseSearch';
import { ExerciseCardHeader } from '@/components/training/ExerciseCardHeader';
import { SetRow } from '@/components/training/SetRow';
import { WodExerciseRow } from '@/components/training/WodExerciseRow';
import { MovementTypePill } from '@/components/training/MovementTypePill';
import { SectionFormatPill } from '@/components/training/SectionFormatPill';
import { SectionFormatConfigRow } from '@/components/training/SectionFormatConfigRow';
import { cn } from '@/lib/cn';
import { formatExerciseSummary } from '@/lib/training-plan-format';
import type { ExerciseSet } from '@/api/training-plan-types';
import {
  deriveSetCompletionState,
  deriveExerciseCompletionState,
  deriveExerciseModificationState,
} from '@/lib/completionState';

/**
 * Left accent bar — Tailwind border-l color classes per format.
 * Applied as `border-l-[3px]` on the card root.
 * Palette only — no hex literals.
 */
const FORMAT_BAR_CLASSES: Record<WorkoutFormat, string> = {
  Standard: 'border-l-gray-300',
  AMRAP:    'border-l-amber-500',
  EMOM:     'border-l-purple-500',
  Tabata:   'border-l-pink-500',
  ForTime:  'border-l-orange-500',
};


interface SectionCardCallbacks {
  onUpdate: (patch: Partial<Pick<TrainingSection, 'name' | 'format' | 'formatConfig' | 'notes'>>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddExercise: (exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onDuplicateExercise: (exerciseIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onDuplicateSet: (exerciseIndex: number, setIndex: number) => void;
  onUpdateSet: (exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;
  onUpdateExerciseNotes: (exerciseIndex: number, notes: string) => void;
  onUpdateExerciseMovementType: (exerciseIndex: number, movementType: MovementType) => void;
  onSaveAsTemplate: () => void;
  // Exercise detail lookups (may be undefined while loading)
  exerciseDetailsMap?: Map<string, MuscleGroup[]>;
  exerciseFullMap?: Map<string, { muscleGroups: MuscleGroup[]; difficulty: string }>;
}

interface SectionCardProps extends SectionCardCallbacks {
  section: TrainingSection;
  weekLabel?: string;
  /** Controlled collapse state — owned by the page so it survives cross-session moves. */
  isExpanded: boolean;
  onToggleExpanded: () => void;
  /** True when last save validation flagged this section (missing name or empty exercises). */
  hasError?: boolean;
  /** Section is read-only — every exercise in it has been completed by the client. */
  isSectionLocked?: boolean;
  /** Exercise IDs that the client has marked complete; their inputs are locked. */
  lockedExerciseIds?: Set<string>;
  /**
   * Execution data for the parent session, used to derive per-set / per-exercise
   * completion state. Pass undefined (or omit) when the plan has no execution data
   * — all badges will be hidden in that case.
   */
  sessionExecution?: SessionExecutionDto;
}

export function SectionCard({
  section,
  isExpanded,
  onToggleExpanded,
  hasError,
  isSectionLocked,
  lockedExerciseIds,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onAddSet,
  onRemoveSet,
  onDuplicateSet,
  onUpdateSet,
  onUpdateExerciseNotes,
  onUpdateExerciseMovementType,
  onSaveAsTemplate,
  exerciseDetailsMap,
  exerciseFullMap,
  sessionExecution,
}: SectionCardProps) {
  const { t } = useTranslation();
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());

  const toggleExercise = (idx: number) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div
      aria-disabled={isSectionLocked || undefined}
      className={cn(
        'rounded-md border border-border bg-bg mb-2 overflow-hidden',
        // Left accent bar — 3px colored left border, format-specific color
        'border-l-[3px]',
        FORMAT_BAR_CLASSES[section.format],
        hasError && 'ring-1 ring-red',
        // `opacity-70 select-none` keep the locked visual cue. We do NOT
        // add a blanket `pointer-events-none` — that would kill the chevron
        // collapse toggles in the section header AND on every exercise row.
        // Instead, arbitrary-variant selectors disable every text input /
        // dropdown / textarea descendant (section notes, exercise notes,
        // set-row inputs, WOD-row inputs, format-config inputs, ExerciseSearch
        // typeahead). Buttons stay clickable so chevrons keep working —
        // mutation-only buttons in the header are guarded individually.
        isSectionLocked &&
          'opacity-70 select-none ' +
          '[&_input]:pointer-events-none [&_input]:cursor-not-allowed ' +
          '[&_select]:pointer-events-none [&_select]:cursor-not-allowed ' +
          '[&_textarea]:pointer-events-none [&_textarea]:cursor-not-allowed',
      )}
    >
      {/* ── Section header row — neutral grey background, matches the format-config row below ── */}
      <div
        data-section-drag-image
        className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-bg2"
      >
        {/* Drag handle — rendered for visual fidelity; DnD wiring is out of scope for this PR */}
        <span
          className="text-text4 cursor-grab active:cursor-grabbing select-none"
          style={{ fontSize: 14 }}
          aria-hidden="true"
        >
          ⠿
        </span>

        {/* Chevron collapse toggle */}
        <button
          type="button"
          onClick={() => onToggleExpanded()}
          className="flex items-center justify-center shrink-0 w-4 h-4 text-text4 transition-colors hover:text-text2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-md"
          aria-label={isExpanded ? t('training.section.collapse') : t('training.section.expand')}
          aria-expanded={isExpanded}
        >
          <span
            className={cn(
              'text-[10px] inline-flex items-center justify-center transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          >
            ▶
          </span>
        </button>

        {/* Editable section name — clicking the label area also toggles; the input itself does not */}
        <div
          className="flex-1 min-w-0 flex items-center"
          onClick={(e) => {
            // Only toggle when the click target is the wrapper div, not the input
            if (e.target === e.currentTarget) {
              onToggleExpanded();
            }
          }}
        >
          <input
            type="text"
            value={section.name}
            placeholder={t('training.section.placeholderName')}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={isSectionLocked}
            className="w-full bg-transparent text-[13px] font-semibold text-text outline-none cursor-text disabled:cursor-not-allowed"
            style={{ fontFamily: 'inherit', minWidth: 0 }}
          />
        </div>

        {/* Format pill — inline in header row. Disabled for locked sections so
            the dropdown doesn't open and the format can't be swapped on a
            workout the client has already finished. */}
        <SectionFormatPill
          format={section.format}
          onFormatChange={(fmt, cfg) => onUpdate({ format: fmt, formatConfig: cfg })}
          disabled={isSectionLocked}
        />

        {/* Save as template — icon button, label appears as native tooltip on hover */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(); }}
          disabled={isSectionLocked}
          style={{
            background: 'none', border: 'none',
            cursor: isSectionLocked ? 'not-allowed' : 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            opacity: isSectionLocked ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!isSectionLocked) e.currentTarget.style.color = 'var(--text2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
          title={t('training.section.saveAsTemplate')}
          aria-label={t('training.section.saveAsTemplate')}
          className="shrink-0"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13.5 14H2.5V2h8.5l2.5 2.5z" />
            <path d="M4.5 2v3.5h5V2" />
            <path d="M4.5 9h7v5h-7z" />
          </svg>
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          disabled={isSectionLocked}
          style={{
            background: 'none', border: 'none',
            cursor: isSectionLocked ? 'not-allowed' : 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            opacity: isSectionLocked ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!isSectionLocked) e.currentTarget.style.color = 'var(--text2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
          title={t('training.section.duplicate')}
          aria-label={t('training.section.duplicate')}
        >
          ⧉
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={isSectionLocked}
          style={{
            background: 'none', border: 'none',
            cursor: isSectionLocked ? 'not-allowed' : 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            opacity: isSectionLocked ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!isSectionLocked) e.currentTarget.style.color = 'var(--red)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
          title={t('training.section.delete')}
          aria-label={t('training.section.delete')}
        >
          ✕
        </button>
      </div>

      {/* ── Collapsible body — uses the same grid-rows transition as session cards. ── */}
      <div className="collapse-grid" data-open={isExpanded}>
        <div className="collapse-content">
          {/* ── Notes row ── */}
          <div
            style={{ padding: '3px 8px 4px', borderBottom: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={section.notes ?? ''}
              placeholder={t('training.section.placeholderNotes')}
              onChange={(e) => onUpdate({ notes: e.target.value || null })}
              className="w-full bg-transparent text-[11px] text-text3 outline-none"
              style={{ fontFamily: 'inherit', fontStyle: 'italic', padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s' }}
              onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
              onBlur={(e) => { e.target.style.background = 'transparent'; }}
            />
          </div>

          {/* ── Format config row (non-Standard formats only) ── */}
          {section.format !== 'Standard' && (
            <SectionFormatConfigRow
              format={section.format}
              formatConfig={section.formatConfig}
              onChange={(patch) =>
                onUpdate({ formatConfig: { ...(section.formatConfig ?? {}), ...patch } })
              }
            />
          )}

          {/* ── Exercise list — flat rows separated by dividers, no card chrome ── */}
          <div>
            {section.exercises.map((ex, exIdx) => {
              const exKey = exIdx;
              const isExOpen = !collapsedExercises.has(exKey);
              // Editor branches on the section format. There is no per-exercise
              // format override — every exercise inherits its section's format.
              const isWodFormat = section.format !== 'Standard';
              // Summary formatting (reps/weight range, time, distance) lives
              // in `formatExerciseSummary` — see the prop pass below.
              const totalVolume = ex.sets.reduce((sum, s) => sum + ((s.reps ?? 0) * (s.weightKg ?? 0)), 0);

              const muscleGroups = exerciseDetailsMap?.get(ex.exerciseExternalId) ?? [];
              const difficulty = exerciseFullMap?.get(ex.exerciseExternalId)?.difficulty;

              const isExerciseLocked =
                lockedExerciseIds?.has(ex.exerciseExternalId) ?? false;

              // Derive completion state for this exercise (additive, display-only).
              // sessionExecution is pre-filtered to this session by the parent.
              const { state: exCompletionState, counts: exCounts } =
                deriveExerciseCompletionState(
                  sessionExecution ? [sessionExecution] : undefined,
                  sessionExecution?.sessionId ?? '',
                  ex.exerciseExternalId,
                  ex.sets.length,
                );

              // Derive modification state: true when any logged set under this
              // exercise has isModified === true. Backend has no per-exercise flag —
              // we derive client-side mirroring deriveExerciseCompletionState.
              const exHasModifications = deriveExerciseModificationState(
                sessionExecution,
                ex.exerciseExternalId,
              );

              // Logged sets for this exercise, keyed by 1-based setNumber.
              const loggedSetsMap = sessionExecution?.loggedSetsByExercise[ex.exerciseExternalId]
                ? Object.fromEntries(
                    sessionExecution.loggedSetsByExercise[ex.exerciseExternalId].map((ls) => [ls.setNumber, ls])
                  )
                : undefined;

              return (
                <div
                  key={exKey}
                  data-item-id={String(exIdx)}
                  aria-disabled={isExerciseLocked || undefined}
                  className={cn(
                    'bg-bg border-b border-border last:border-b-0 transition-colors hover:bg-bg-hover',
                    // Same surgery as the section-level lock: keep the
                    // dimmed visual cue + drop blanket `pointer-events-none`
                    // (which used to block the exercise chevron), and
                    // disable just the inputs / selects / textareas via
                    // arbitrary-variant selectors.
                    isExerciseLocked &&
                      'opacity-70 select-none ' +
                      '[&_input]:pointer-events-none [&_input]:cursor-not-allowed ' +
                      '[&_select]:pointer-events-none [&_select]:cursor-not-allowed ' +
                      '[&_textarea]:pointer-events-none [&_textarea]:cursor-not-allowed',
                  )}
                >
                  <ExerciseCardHeader
                    exercise={ex}
                    muscleGroups={muscleGroups}
                    // Movement-type-aware summary string built by the
                    // shared `formatExerciseSummary` helper — handles
                    // Reps / Time / Distance / RepsForTime and dropps the
                    // setCount prefix for WOD sections.
                    summaryText={formatExerciseSummary(
                      ex.sets,
                      ex.movementType,
                      isWodFormat,
                    )}
                    totalVolume={totalVolume}
                    isWod={isWodFormat}
                    isOpen={isExOpen}
                    onToggle={() => toggleExercise(exKey)}
                    onDuplicate={() => onDuplicateExercise(exIdx)}
                    onRemove={() => onRemoveExercise(exIdx)}
                    difficulty={difficulty}
                    // Disable duplicate / remove when this row's section is
                    // locked (covers session-finished + day-in-past via the
                    // page-level prop) OR when this specific exercise is
                    // finished by the client. Chevron stays clickable.
                    disabled={isSectionLocked || isExerciseLocked}
                    // Completion state (additive, display-only).
                    exerciseCompletionState={exCompletionState}
                    exerciseCounts={exCounts}
                    // Modification roll-up: true when any set under this exercise
                    // has isModified === true (derived client-side).
                    hasModifications={exHasModifications || undefined}
                  />

                  <div className="collapse-grid" data-open={isExOpen}>
                    <div className="collapse-content">
                      <div className="px-3 py-2">
                        {/* Exercise note — placed above the series table so the
                            trainer can leave coaching cues right under the
                            exercise header. */}
                        <div style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                          <input
                            type="text"
                            value={ex.notes ?? ''}
                            onChange={(e) => onUpdateExerciseNotes(exIdx, e.target.value)}
                            placeholder={t('training.notePlaceholder')}
                            style={{
                              width: '100%', border: 'none', outline: 'none', background: 'transparent',
                              fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                              padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                            }}
                            onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
                            onBlur={(e) => { e.target.style.background = 'transparent'; }}
                          />
                        </div>
                        {isWodFormat ? (
                          /* WOD formats — single line: movement pill + inline labeled inputs. */
                          ex.sets.length > 0 && (
                            <div className="flex items-center gap-3 flex-wrap">
                              <MovementTypePill
                                value={ex.movementType}
                                onChange={(mt) => onUpdateExerciseMovementType(exIdx, mt)}
                                sectionFormat={section.format}
                              />
                              <WodExerciseRow
                                set={ex.sets[0]}
                                movementType={ex.movementType}
                                sectionFormat={section.format}
                                onUpdate={(updates) => onUpdateSet(exIdx, 0, updates)}
                                loggedSet={loggedSetsMap?.[ex.sets[0].setNumber]}
                              />
                            </div>
                          )
                        ) : (
                          <div style={{ paddingLeft: 6, paddingRight: 6 }}>
                            {/* Standard layout: classic strength-training table —
                                series, weight, reps, rest. No movement-type
                                picker; reps/weight/rest are the only columns
                                that apply, so we hard-code that variant.
                                Header uses the same 6-column grid as `SetRow`
                                so each label sits exactly above its column. */}
                            <div
                              className="grid gap-2 mb-1 items-center text-[10px] font-medium text-text3 uppercase"
                              style={{ gridTemplateColumns: '28px 1fr 68px 68px 90px 24px 56px' }}
                            >
                              {/* Match SetRow's 7-column grid AND its child
                                  order: setNumber (col 1), 1fr spacer (col 2),
                                  weight / reps / rest (cols 3-5), completion
                                  badge (col 6), remove button (col 7).
                                  `whitespace-nowrap` keeps longer labels like
                                  "ODPOČINEK (S)" on one line. */}
                              <span className="text-center whitespace-nowrap">{t('training.setsLabel')}</span>
                              <span />
                              <span className="text-center whitespace-nowrap">{t('training.weightLabel')}</span>
                              <span className="text-center whitespace-nowrap">{t('training.repsLabel')}</span>
                              <span className="text-center whitespace-nowrap">{t('training.restSecondsLabel')}</span>
                              <span />
                              <span />
                            </div>

                            {/* Set rows (planned sets) */}
                            {ex.sets.map((s, sIdx) => (
                              <SetRow
                                key={sIdx}
                                set={s}
                                movementType="Reps"
                                onUpdate={(updates) => onUpdateSet(exIdx, sIdx, updates)}
                                onDuplicate={() => onDuplicateSet(exIdx, sIdx)}
                                onRemove={() => onRemoveSet(exIdx, sIdx)}
                                completionState={
                                  sessionExecution
                                    ? deriveSetCompletionState(
                                        [sessionExecution],
                                        sessionExecution.sessionId,
                                        ex.exerciseExternalId,
                                        s.setNumber,
                                      )
                                    : undefined
                                }
                                // Logged-set actual/planned overlay when available
                                loggedSet={loggedSetsMap?.[s.setNumber]}
                              />
                            ))}
                            {/* Extra sets — sets logged beyond the plan count.
                                These have set numbers > ex.sets.length. */}
                            {loggedSetsMap &&
                              Object.values(loggedSetsMap)
                                .filter((ls) => !ex.sets.some((s) => s.setNumber === ls.setNumber))
                                .sort((a, b) => a.setNumber - b.setNumber)
                                .map((ls) => (
                                  <SetRow
                                    key={`extra-${ls.setNumber}`}
                                    set={{
                                      setNumber: ls.setNumber,
                                      type: 'Normal',
                                      reps: null,
                                      weightKg: null,
                                      durationSeconds: null,
                                      rpe: null,
                                      distanceMeters: null,
                                      restSeconds: null,
                                    }}
                                    movementType="Reps"
                                    onUpdate={() => {/* extra sets are read-only */}}
                                    onRemove={() => {/* extra sets are read-only */}}
                                    completionState="completed"
                                    loggedSet={ls}
                                    isExtraSet
                                  />
                                ))}

                            {/* Add set — hidden when the section is locked
                                (also covers session-locked + day-in-past per
                                the `isSectionLocked` prop) or the specific
                                exercise is finished by the client. Adding
                                fresh sets to a historical or completed
                                workout has no clinical value. */}
                            {!isSectionLocked && !isExerciseLocked && (
                              <button
                                type="button"
                                onClick={() => onAddSet(exIdx)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 11, color: 'var(--text4)', fontFamily: 'inherit', transition: 'color 0.1s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                              >
                                + {t('training.addSet')}
                              </button>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Add exercise — hidden when the section is locked (covers
              section-finished, session-finished, and day-in-past via the
              broadened `isSectionLocked` prop on the page). Adding fresh
              exercises to a historical or completed workout has no
              clinical value. */}
          {!isSectionLocked && (
            <div
              className="px-2 pb-2 pt-2"
              style={{ borderTop: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExerciseSearch
                onSelect={(exercise) => onAddExercise(exercise)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
