import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrainingSection, WodConfig, WorkoutFormat, MovementType } from '@/api/training-plan-types';
import type { MuscleGroup } from '@/api/exercise-types';
import { ExerciseSearch } from '@/components/training/ExerciseSearch';
import { ExerciseCardHeader } from '@/components/training/ExerciseCardHeader';
import { SetRow } from '@/components/training/SetRow';
import { MovementTypePill } from '@/components/training/MovementTypePill';
import { ExerciseFormatBar } from '@/components/training/ExerciseFormatBar';
import { SectionFormatBar } from '@/components/training/SectionFormatBar';
import { cn } from '@/lib/cn';
import { MUSCLE_COLORS, MUSCLE_ICONS } from '@/constants/training';
import type { ExerciseSet } from '@/api/training-plan-types';

// Map workout format to a Tailwind left-border color class.
// Uses Tailwind palette classes only — no hex literals.
function formatBorderClass(format: WorkoutFormat): string {
  switch (format) {
    case 'AMRAP':
      return 'border-l-blue-500';
    case 'EMOM':
      return 'border-l-amber-500';
    case 'Tabata':
      return 'border-l-purple-500';
    case 'ForTime':
      return 'border-l-green-500';
    default:
      // Standard — neutral left border color
      return 'border-l-border';
  }
}

interface SectionCardCallbacks {
  onUpdate: (patch: Partial<Pick<TrainingSection, 'name' | 'format' | 'formatConfig' | 'notes'>>) => void;
  onRemove: () => void;
  onAddExercise: (exercise: { exerciseExternalId: string; exerciseName: string }) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onDuplicateExercise: (exerciseIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onUpdateSet: (exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;
  onUpdateExerciseNotes: (exerciseIndex: number, notes: string) => void;
  onUpdateExerciseMovementType: (exerciseIndex: number, movementType: MovementType) => void;
  onUpdateExerciseFormat: (exerciseIndex: number, format: WorkoutFormat | null, formatConfig?: WodConfig | null) => void;
  onSaveAsTemplate: () => void;
  // Exercise detail lookups (may be undefined while loading)
  exerciseDetailsMap?: Map<string, MuscleGroup[]>;
  exerciseFullMap?: Map<string, { muscleGroups: MuscleGroup[]; difficulty: string }>;
  // Session-level format (for exercise format inheritance display)
  sessionFormat: WorkoutFormat;
}

interface SectionCardProps extends SectionCardCallbacks {
  section: TrainingSection;
  weekLabel?: string;
}

export function SectionCard({
  section,
  sessionFormat,
  onUpdate,
  onRemove,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onUpdateExerciseNotes,
  onUpdateExerciseMovementType,
  onUpdateExerciseFormat,
  onSaveAsTemplate,
  exerciseDetailsMap,
  exerciseFullMap,
}: SectionCardProps) {
  const { t } = useTranslation();
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

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
      className={cn(
        'rounded-md border border-border bg-bg mb-2 overflow-hidden',
        'border-l-[3px]',
        formatBorderClass(section.format),
      )}
    >
      {/* ── Section header row ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-bg2">
        {/* Drag handle — rendered for visual fidelity; DnD wiring is out of scope for this PR */}
        <span
          className="text-text4 cursor-grab active:cursor-grabbing select-none"
          style={{ fontSize: 14 }}
          aria-hidden="true"
        >
          ⠿
        </span>

        {/* Editable section name */}
        <input
          type="text"
          value={section.name}
          placeholder={t('training.section.placeholderName')}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-[13px] font-semibold text-text outline-none"
          style={{ fontFamily: 'inherit', minWidth: 0 }}
        />

        {/* Format selector (scoped to this section) */}
        <div onClick={(e) => e.stopPropagation()}>
          <SectionFormatBar
            format={section.format}
            formatConfig={section.formatConfig}
            onFormatChange={(fmt, cfg) => onUpdate({ format: fmt, formatConfig: cfg })}
          />
        </div>

        {/* Save as template */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(); }}
          className="text-[11px] text-text3 px-2 py-1 rounded-md transition-colors hover:bg-bg3 hover:text-text2 shrink-0"
          style={{ fontFamily: 'inherit' }}
        >
          {t('training.section.saveAsTemplate')}
        </button>

        {/* Three-dot menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text4 transition-colors hover:bg-bg3 hover:text-text2"
            style={{ fontFamily: 'inherit' }}
            aria-label={t('common.actions')}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              {/* Backdrop to close menu on outside click */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-7 z-20 min-w-[140px] rounded-md border border-border bg-bg shadow-md py-1"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRemove(); }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-danger transition-colors hover:bg-bg2"
                  style={{ fontFamily: 'inherit' }}
                >
                  {t('training.section.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Notes row (shown always; hide if empty and no focus) ── */}
      <div style={{ padding: '3px 8px 4px' }} onClick={(e) => e.stopPropagation()}>
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

      {/* ── Exercise list ── */}
      <div className="px-2 pt-1">
        {section.exercises.map((ex, exIdx) => {
          const exKey = exIdx;
          const isExOpen = !collapsedExercises.has(exKey);
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
          const primaryMuscle = muscleGroups[0] as string | undefined;
          const muscleColor = primaryMuscle ? (MUSCLE_COLORS[primaryMuscle] ?? 'var(--accent)') : 'var(--accent)';
          const muscleIcon = primaryMuscle ? (MUSCLE_ICONS[primaryMuscle] ?? '🏋️') : '🏋️';
          const difficulty = exerciseFullMap?.get(ex.exerciseExternalId)?.difficulty;

          return (
            <div
              key={exKey}
              data-item-id={String(exIdx)}
              className="rounded-md border border-border bg-bg mb-1.5 overflow-hidden transition-all duration-100 hover:border-border-md"
            >
              <ExerciseCardHeader
                exercise={ex}
                muscleGroups={muscleGroups}
                repsStr={repsStr}
                weightStr={weightStr}
                setsCount={setsCount}
                totalVolume={totalVolume}
                isOpen={isExOpen}
                onToggle={() => toggleExercise(exKey)}
                onDuplicate={() => onDuplicateExercise(exIdx)}
                onRemove={() => onRemoveExercise(exIdx)}
                difficulty={difficulty}
                muscleColor={muscleColor}
                muscleIcon={muscleIcon}
              />

              <div className="collapse-grid" data-open={isExOpen}>
                <div className="collapse-content">
                  {/* Per-exercise format override */}
                  <ExerciseFormatBar
                    format={ex.format}
                    formatConfig={ex.formatConfig}
                    sessionFormat={sessionFormat}
                    onFormatChange={(fmt, cfg) => onUpdateExerciseFormat(exIdx, fmt, cfg)}
                  />

                  <div className="px-3 py-2">
                    {/* MovementType picker + column headers */}
                    <div className="flex items-center justify-between mb-1">
                      <MovementTypePill
                        value={ex.movementType}
                        onChange={(mt) => onUpdateExerciseMovementType(exIdx, mt)}
                      />
                      <div className="flex items-center gap-2 text-[10px] font-medium text-text3 uppercase">
                        {ex.movementType === 'Reps' && (
                          <>
                            <span className="w-[68px] text-right">{t('training.weightLabel')}</span>
                            <span className="w-[68px] text-right">{t('training.repsLabel')}</span>
                            <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                          </>
                        )}
                        {ex.movementType === 'Time' && (
                          <>
                            <span className="w-[80px] text-right">{t('training.wod.durationLabel')}</span>
                            <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                          </>
                        )}
                        {ex.movementType === 'Distance' && (
                          <>
                            <span className="w-[80px] text-right">{t('training.wod.distanceLabel')}</span>
                            <span className="w-[80px] text-right">{t('training.wod.durationLabel')}</span>
                            <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                          </>
                        )}
                        {ex.movementType === 'RepsForTime' && (
                          <>
                            <span className="w-[68px] text-right">{t('training.repsLabel')}</span>
                            <span className="w-[90px] text-right">{t('training.restSecondsLabel')}</span>
                          </>
                        )}
                        <span className="w-5" />
                      </div>
                    </div>

                    {/* Set rows */}
                    {ex.sets.map((s, sIdx) => (
                      <SetRow
                        key={sIdx}
                        set={s}
                        movementType={ex.movementType}
                        onUpdate={(updates) => onUpdateSet(exIdx, sIdx, updates)}
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

                    {/* Exercise note */}
                    <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
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
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add exercise ── */}
      <div className="px-2 pb-2" onClick={(e) => e.stopPropagation()}>
        <ExerciseSearch
          onSelect={(exercise) => onAddExercise(exercise)}
        />
      </div>
    </div>
  );
}
