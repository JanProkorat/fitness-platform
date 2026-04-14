import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { searchExercises } from '@/api/exercises';
import type { ExerciseSummary } from '@/api/exercise-types';

interface StagedExercise {
  exerciseExternalId: string;
  exerciseName: string;
  equipment: string;
  restSeconds: number | null;
  sets: { setNumber: number; reps: number | null; weightKg: number | null }[];
}

interface AddExercisesDrawerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exercises: StagedExercise[]) => void;
}

export type { StagedExercise };

export default function AddExercisesDrawer({ open, onClose, onAdd }: AddExercisesDrawerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [staged, setStaged] = useState<StagedExercise[]>([]);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate in
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      setStaged([]);
      setQuery('');
      setResults([]);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && visible) {
      inputRef.current?.focus();
    }
  }, [open, visible]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchExercises({ q: query, pageSize: 10 });
        setResults(data.exercises ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isBodyweight = (equipment: string) =>
    equipment === 'Bodyweight' || equipment === 'None';

  const addToStaged = useCallback((exercise: ExerciseSummary) => {
    if (staged.some((s) => s.exerciseExternalId === exercise.exerciseId)) return;
    setStaged((prev) => [
      ...prev,
      {
        exerciseExternalId: exercise.exerciseId,
        exerciseName: exercise.name,
        equipment: exercise.equipment,
        restSeconds: 90,
        sets: [
          { setNumber: 1, reps: 10, weightKg: null },
          { setNumber: 2, reps: 10, weightKg: null },
          { setNumber: 3, reps: 10, weightKg: null },
        ],
      },
    ]);
  }, [staged]);

  const removeStaged = (id: string) => {
    setStaged((prev) => prev.filter((s) => s.exerciseExternalId !== id));
  };

  const updateSetCount = (id: string, count: number) => {
    const clamped = Math.max(1, Math.min(20, count));
    setStaged((prev) =>
      prev.map((ex) => {
        if (ex.exerciseExternalId !== id) return ex;
        const currentSets = ex.sets;
        if (clamped > currentSets.length) {
          const newSets = [...currentSets];
          for (let i = currentSets.length; i < clamped; i++) {
            newSets.push({ setNumber: i + 1, reps: 10, weightKg: null });
          }
          return { ...ex, sets: newSets };
        }
        return { ...ex, sets: currentSets.slice(0, clamped).map((s, i) => ({ ...s, setNumber: i + 1 })) };
      }),
    );
  };

  const updateRestSeconds = (id: string, restSeconds: number | null) => {
    setStaged((prev) =>
      prev.map((ex) => (ex.exerciseExternalId === id ? { ...ex, restSeconds } : ex)),
    );
  };

  const updateSetField = (
    exId: string,
    setIdx: number,
    field: 'reps' | 'weightKg',
    value: number | null,
  ) => {
    setStaged((prev) =>
      prev.map((ex) =>
        ex.exerciseExternalId === exId
          ? { ...ex, sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)) }
          : ex,
      ),
    );
  };

  const handleAdd = () => {
    if (staged.length === 0) return;
    onAdd(staged);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-[520px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-sm font-semibold">{t('training.addExercisesToSession')}</span>
          <button onClick={onClose} className="text-text3 transition-colors hover:text-text" aria-label="Close drawer">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Exercise search */}
          <div className="mb-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text3">
              {t('training.searchExercises')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('training.searchExercisesPlaceholder')}
              className="w-full rounded-md border border-border-md bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-border-hv"
            />

            {loading && (
              <div className="mt-2 text-center text-xs text-text3">{t('common.loading')}</div>
            )}

            {!loading && results.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-sm border border-border">
                {results.map((exercise) => {
                  const isSelected = staged.some((s) => s.exerciseExternalId === exercise.exerciseId);
                  return (
                    <button
                      key={exercise.exerciseId}
                      onClick={() => addToStaged(exercise)}
                      disabled={isSelected}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-accent-bg text-accent opacity-60'
                          : 'hover:bg-bg-hover'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="truncate font-medium">{exercise.name}</span>
                        <span className="text-[10px] text-text3">
                          {t(`enums.muscleGroup.${exercise.muscleGroups[0]}`)}
                          {exercise.muscleGroups.length > 1 && ` +${exercise.muscleGroups.length - 1}`}
                          {' · '}
                          {t(`enums.equipment.${exercise.equipment}`)}
                        </span>
                      </div>
                      <span className="ml-3 shrink-0 rounded-sm bg-bg3 px-1.5 py-0.5 text-[10px] text-text3">
                        {t(`enums.difficulty.${exercise.difficulty}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <div className="mt-2 text-center text-xs text-text3">{t('exercises.noExercises')}</div>
            )}
          </div>

          {/* Staged exercises with sets configuration */}
          {staged.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text3">
                {t('training.selectedExercises')} ({staged.length})
              </label>
              <div className="flex flex-col gap-3">
                {staged.map((ex) => (
                  <div key={ex.exerciseExternalId} className="rounded-sm border border-border bg-bg2">
                    {/* Exercise header */}
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="text-sm font-semibold text-text truncate">{ex.exerciseName}</span>
                      <button
                        onClick={() => removeStaged(ex.exerciseExternalId)}
                        className="text-text3 transition-colors hover:text-red-400"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Sets configuration */}
                    <div className="px-3 py-2">
                      <div className="mb-2 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase text-text3">{t('training.setsCount')}:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={ex.sets.length}
                            onChange={(e) => updateSetCount(ex.exerciseExternalId, Number(e.target.value) || 1)}
                            className="w-14 rounded-sm border border-border bg-bg px-2 py-0.5 text-center text-xs text-text outline-none focus:border-border-hv"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase text-text3">{t('training.restLabel')}:</span>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            step={5}
                            value={ex.restSeconds ?? ''}
                            onChange={(e) => updateRestSeconds(ex.exerciseExternalId, e.target.value ? Number(e.target.value) : null)}
                            placeholder="s"
                            className="w-16 rounded-sm border border-border bg-bg px-2 py-0.5 text-center text-xs text-text outline-none focus:border-border-hv"
                          />
                          <span className="text-[10px] text-text3">s</span>
                        </div>
                      </div>

                      {/* Sets table */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[9px] uppercase text-text3">
                            <th className="w-8 py-1 font-medium">#</th>
                            <th className="py-1 font-medium">{t('training.reps')}</th>
                            {!isBodyweight(ex.equipment) && (
                              <th className="py-1 font-medium">{t('training.kg')}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {ex.sets.map((set, sIdx) => (
                            <tr key={sIdx}>
                              <td className="py-0.5 text-text3 font-mono">{set.setNumber}</td>
                              <td className="py-0.5 pr-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={set.reps ?? ''}
                                  onChange={(e) =>
                                    updateSetField(ex.exerciseExternalId, sIdx, 'reps', e.target.value ? Number(e.target.value) : null)
                                  }
                                  placeholder="—"
                                  className="w-16 rounded-sm border border-border bg-bg px-1.5 py-0.5 text-center text-xs text-text outline-none focus:border-border-hv"
                                />
                              </td>
                              {!isBodyweight(ex.equipment) && (
                                <td className="py-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={set.weightKg ?? ''}
                                    onChange={(e) =>
                                      updateSetField(ex.exerciseExternalId, sIdx, 'weightKg', e.target.value ? Number(e.target.value) : null)
                                    }
                                    placeholder="kg"
                                    className="w-16 rounded-sm border border-border bg-bg px-1.5 py-0.5 text-center text-xs text-text outline-none focus:border-border-hv"
                                  />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky add button */}
        <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
          <button
            onClick={handleAdd}
            disabled={staged.length === 0}
            className="w-full rounded-sm bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wide text-bg transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {t('training.addToSession')} ({staged.length})
          </button>
        </div>
      </div>
    </>
  );
}
