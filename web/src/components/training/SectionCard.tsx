import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrainingSection, WorkoutFormat, MovementType } from '@/api/training-plan-types';
import type { MuscleGroup } from '@/api/exercise-types';
import { ExerciseSearch } from '@/components/training/ExerciseSearch';
import { ExerciseCardHeader } from '@/components/training/ExerciseCardHeader';
import { SetRow } from '@/components/training/SetRow';
import { WodExerciseRow } from '@/components/training/WodExerciseRow';
import { MovementTypePill } from '@/components/training/MovementTypePill';
import { SectionFormatPill } from '@/components/training/SectionFormatPill';
import { SectionFormatConfigRow } from '@/components/training/SectionFormatConfigRow';
import { cn } from '@/lib/cn';
import type { ExerciseSet } from '@/api/training-plan-types';

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
        isSectionLocked && 'opacity-70 pointer-events-none select-none',
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
            className="w-full bg-transparent text-[13px] font-semibold text-text outline-none cursor-text"
            style={{ fontFamily: 'inherit', minWidth: 0 }}
          />
        </div>

        {/* Format pill — inline in header row */}
        <SectionFormatPill
          format={section.format}
          onFormatChange={(fmt, cfg) => onUpdate({ format: fmt, formatConfig: cfg })}
        />

        {/* Save as template — icon button, label appears as native tooltip on hover */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)'; }}
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
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)'; }}
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
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
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
              const setsCount = ex.sets.length;
              const repsValues = ex.sets.map((s) => s.reps).filter((r): r is number => r != null);
              const weightValues = ex.sets.map((s) => s.weightKg).filter((w): w is number => w != null);
              const repsMin = repsValues.length > 0 ? Math.min(...repsValues) : null;
              const repsMax = repsValues.length > 0 ? Math.max(...repsValues) : null;
              const weightMin = weightValues.length > 0 ? Math.min(...weightValues) : null;
              const weightMax = weightValues.length > 0 ? Math.max(...weightValues) : null;
              const repsStr = repsMin == null ? '–' : repsMin === repsMax ? `${repsMin}` : `${repsMin}-${repsMax}`;
              const weightStr = weightMin == null ? '–' : weightMin === weightMax ? `${weightMin}` : `${weightMin}-${weightMax}`;
              const totalVolume = ex.sets.reduce((sum, s) => sum + ((s.reps ?? 0) * (s.weightKg ?? 0)), 0);

              const muscleGroups = exerciseDetailsMap?.get(ex.exerciseExternalId) ?? [];
              const difficulty = exerciseFullMap?.get(ex.exerciseExternalId)?.difficulty;

              const isExerciseLocked =
                lockedExerciseIds?.has(ex.exerciseExternalId) ?? false;

              return (
                <div
                  key={exKey}
                  data-item-id={String(exIdx)}
                  aria-disabled={isExerciseLocked || undefined}
                  className={cn(
                    'bg-bg border-b border-border last:border-b-0 transition-colors hover:bg-bg-hover',
                    isExerciseLocked && 'opacity-70 pointer-events-none select-none',
                  )}
                >
                  <ExerciseCardHeader
                    exercise={ex}
                    muscleGroups={muscleGroups}
                    repsStr={repsStr}
                    weightStr={weightStr}
                    setsCount={setsCount}
                    totalVolume={totalVolume}
                    isWod={isWodFormat}
                    isOpen={isExOpen}
                    onToggle={() => toggleExercise(exKey)}
                    onDuplicate={() => onDuplicateExercise(exIdx)}
                    onRemove={() => onRemoveExercise(exIdx)}
                    difficulty={difficulty}
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
                              />
                              <WodExerciseRow
                                set={ex.sets[0]}
                                movementType={ex.movementType}
                                sectionFormat={section.format}
                                onUpdate={(updates) => onUpdateSet(exIdx, 0, updates)}
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
                              style={{ gridTemplateColumns: '28px 1fr 68px 68px 90px 56px' }}
                            >
                              {/* Match SetRow's 6-column grid AND its child
                                  order: setNumber (col 1), 1fr spacer (col 2),
                                  weight / reps / rest (cols 3-5), remove
                                  button (col 6). `whitespace-nowrap` keeps
                                  longer labels like "ODPOČINEK (S)" on one
                                  line. */}
                              <span className="text-center whitespace-nowrap">{t('training.setsLabel')}</span>
                              <span />
                              <span className="text-center whitespace-nowrap">{t('training.weightLabel')}</span>
                              <span className="text-center whitespace-nowrap">{t('training.repsLabel')}</span>
                              <span className="text-center whitespace-nowrap">{t('training.restSecondsLabel')}</span>
                              <span />
                            </div>

                            {/* Set rows */}
                            {ex.sets.map((s, sIdx) => (
                              <SetRow
                                key={sIdx}
                                set={s}
                                movementType="Reps"
                                onUpdate={(updates) => onUpdateSet(exIdx, sIdx, updates)}
                                onDuplicate={() => onDuplicateSet(exIdx, sIdx)}
                                onRemove={() => onRemoveSet(exIdx, sIdx)}
                              />
                            ))}

                            {/* Add set */}
                            <button
                              type="button"
                              onClick={() => onAddSet(exIdx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 11, color: 'var(--text4)', fontFamily: 'inherit', transition: 'color 0.1s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
                            >
                              + {t('training.addSet')}
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Add exercise ── */}
          <div
            className="px-2 pb-2 pt-2"
            style={{ borderTop: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExerciseSearch
              onSelect={(exercise) => onAddExercise(exercise)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
