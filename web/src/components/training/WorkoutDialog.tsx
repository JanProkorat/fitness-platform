import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSectionTemplate,
  updateSectionTemplate,
  getSectionTemplate,
} from '@/api/sectionTemplates';
import type { SectionTemplateResponse } from '@/api/sectionTemplates';
import type {
  CreateSectionTemplateExerciseRequest,
  CreateSectionTemplateSetRequest,
  WorkoutFormat as GenWorkoutFormat,
  WodConfig as GenWodConfig,
} from '@/api/generated';
import { MovementType as GenMovementType, SetType as GenSetType } from '@/api/generated';
import { searchExercises } from '@/api/exercises';
import type { ExerciseSummary } from '@/api/exercise-types';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { INPUT_CLASS_SM, CANCEL_BUTTON_CLASS } from '@/lib/styles';
import { FORMAT_LABEL_KEYS, MUSCLE_COLORS, MUSCLE_BG_COLORS } from '@/constants/training';
import { SectionFormatConfigRow } from '@/components/training/SectionFormatConfigRow';

const FORMATS: WorkoutFormat[] = ['Standard', 'EMOM', 'AMRAP', 'ForTime', 'Tabata'];

function defaultConfig(format: WorkoutFormat): WodConfig | null {
  switch (format) {
    case 'ForTime':
      return { timeCapSeconds: null };
    case 'AMRAP':
      return { timeCapSeconds: null, totalRounds: 0 };
    case 'EMOM':
      return { intervalSeconds: 60, totalRounds: null };
    case 'Tabata':
      return { workSeconds: 20, restSeconds: 10, totalRounds: 8 };
    default:
      return null;
  }
}

interface ExerciseSet {
  reps: number | '';
  weightKg: number | '';
  restSeconds: number | '';
}

interface ExerciseRow {
  exerciseExternalId: string;
  exerciseName: string;
  notes: string;
  sets: ExerciseSet[];
}

const emptySet = (): ExerciseSet => ({ reps: '', weightKg: '', restSeconds: '' });

export interface WorkoutDialogProps {
  open: boolean;
  template?: SectionTemplateResponse | null;
  onClose: () => void;
  onSaved: () => void;
}

export function WorkoutDialog({ open, template, onClose, onSaved }: WorkoutDialogProps) {
  const { t } = useTranslation();
  const isNew = !template;

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [format, setFormat] = useState<WorkoutFormat>('Standard');
  const [formatConfig, setFormatConfig] = useState<WodConfig | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [exQuery, setExQuery] = useState('');
  const [exResults, setExResults] = useState<ExerciseSummary[]>([]);
  const [exFocused, setExFocused] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  const resetForm = useCallback(() => {
    setName('');
    setNotes('');
    setFormat('Standard');
    setFormatConfig(null);
    setExercises([]);
    setVersion(undefined);
    setExQuery('');
    setExResults([]);
    setExFocused(false);
  }, []);

  const populateFromTemplate = useCallback((tpl: SectionTemplateResponse) => {
    setName(tpl.name ?? '');
    setNotes(tpl.notes ?? '');
    const fmt = ((tpl.defaultFormat ?? 'Standard') as WorkoutFormat);
    setFormat(fmt);
    setFormatConfig(tpl.defaultFormatConfig ?? null);
    setVersion(tpl.version);
    setExercises(
      (tpl.defaultExercises ?? []).map((ex) => ({
        exerciseExternalId: ex.exerciseExternalId ?? '',
        exerciseName: ex.exerciseName ?? '',
        notes: ex.notes ?? '',
        sets: (ex.sets && ex.sets.length > 0
          ? ex.sets
          : [{ reps: undefined, weightKg: undefined, restSeconds: undefined }]
        ).map((set) => ({
          reps: set.reps ?? '',
          weightKg: set.weightKg ?? '',
          restSeconds: set.restSeconds ?? '',
        })),
      })),
    );
  }, []);

  useEffect(() => {
    if (!open) { resetForm(); return; }
    if (isNew) { resetForm(); return; }
    if (template) populateFromTemplate(template);
    if (template?.templateId) {
      setLoading(true);
      getSectionTemplate(template.templateId)
        .then((fresh) => populateFromTemplate(fresh))
        .catch(() => { /* keep summary data */ })
        .finally(() => setLoading(false));
    }
  }, [open, template?.templateId, isNew, resetForm, populateFromTemplate, template]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const loadExercises = useCallback(async (q: string) => {
    try {
      const r = await searchExercises({ q: q || undefined, pageSize: 15, page: 1 });
      setExResults(r.exercises ?? []);
    } catch {
      setExResults([]);
    }
  }, []);
  useEffect(() => { if (open && !loading) loadExercises(''); }, [open, loading, loadExercises]);
  useEffect(() => {
    const timer = setTimeout(() => { if (open) loadExercises(exQuery); }, 300);
    return () => clearTimeout(timer);
  }, [exQuery, open, loadExercises]);

  const handleFormatChange = (f: WorkoutFormat) => {
    setFormat(f);
    setFormatConfig(f === 'Standard' ? null : defaultConfig(f));
    if (f !== 'Standard') {
      setExercises((p) =>
        p.map((row) => ({
          ...row,
          sets: row.sets.length > 0
            ? [{ ...row.sets[0], restSeconds: '' }]
            : [emptySet()],
        })),
      );
    }
  };

  const addExercise = (ex: ExerciseSummary) => {
    if (exercises.some((row) => row.exerciseExternalId === ex.exerciseId)) return;
    setExercises((p) => [
      ...p,
      { exerciseExternalId: ex.exerciseId, exerciseName: ex.name, notes: '', sets: [emptySet()] },
    ]);
    setExQuery('');
  };
  const removeExercise = (i: number) => setExercises((p) => p.filter((_, j) => j !== i));
  const updateExerciseNotes = (exIdx: number, value: string) =>
    setExercises((p) => p.map((row, j) => (j !== exIdx ? row : { ...row, notes: value })));
  const addSet = (exIdx: number) =>
    setExercises((p) =>
      p.map((row, j) => (j === exIdx ? { ...row, sets: [...row.sets, emptySet()] } : row)),
    );
  const removeSet = (exIdx: number, setIdx: number) =>
    setExercises((p) =>
      p.map((row, j) =>
        j !== exIdx
          ? row
          : { ...row, sets: row.sets.length > 1 ? row.sets.filter((_, k) => k !== setIdx) : row.sets },
      ),
    );
  const updateSet = (exIdx: number, setIdx: number, patch: Partial<ExerciseSet>) =>
    setExercises((p) =>
      p.map((row, j) =>
        j !== exIdx
          ? row
          : { ...row, sets: row.sets.map((s, k) => (k === setIdx ? { ...s, ...patch } : s)) },
      ),
    );

  const handleSave = async () => {
    if (!name.trim()) return;
    if (format !== 'Standard' && !formatConfig) return;
    setSaving(true);
    const payloadExercises: CreateSectionTemplateExerciseRequest[] = exercises.map((row, idx) => {
      const setsToEmit = format === 'Standard' ? row.sets : row.sets.slice(0, 1);
      const trimmedExNotes = row.notes.trim();
      return {
        exerciseExternalId: row.exerciseExternalId,
        exerciseName: row.exerciseName,
        order: idx + 1,
        notes: trimmedExNotes === '' ? undefined : trimmedExNotes,
        movementType: GenMovementType.Reps,
        sets: setsToEmit.map(
          (s, i): CreateSectionTemplateSetRequest => ({
            setNumber: i + 1,
            type: GenSetType.Normal,
            reps: s.reps === '' ? undefined : s.reps,
            weightKg: s.weightKg === '' ? undefined : s.weightKg,
            restSeconds:
              format === 'Standard' && s.restSeconds !== '' ? s.restSeconds : undefined,
          }),
        ),
      };
    });

    const trimmedNotes = notes.trim();
    const notesPayload = trimmedNotes === '' ? undefined : trimmedNotes;

    try {
      if (isNew) {
        await createSectionTemplate({
          name: name.trim(),
          notes: notesPayload,
          defaultFormat: (format as GenWorkoutFormat) ?? undefined,
          defaultFormatConfig: (formatConfig as GenWodConfig | null) ?? undefined,
          defaultExercises: payloadExercises,
        });
        showSuccess('training.template.created');
      } else {
        if (!template?.templateId) throw new Error('no template id');
        await updateSectionTemplate(template.templateId, {
          name: name.trim(),
          notes: notesPayload,
          defaultFormat: (format as GenWorkoutFormat) ?? undefined,
          defaultFormatConfig: (formatConfig as GenWodConfig | null) ?? undefined,
          defaultExercises: payloadExercises,
          version,
        });
        showSuccess('training.template.updated');
      }
      onSaved();
      onClose();
    } catch (err) {
      showApiError(err, isNew ? 'training.template.createError' : 'training.template.updateError');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Backend validators require these fields > 0 per format. Mirror the rules
  // here so the user can't submit a form the API will reject.
  const formatConfigReady = (() => {
    if (format === 'Standard') return true;
    const c = formatConfig;
    if (!c) return false;
    switch (format) {
      case 'EMOM':
        return (c.intervalSeconds ?? 0) > 0 && (c.totalRounds ?? 0) > 0;
      case 'AMRAP':
      case 'ForTime':
        return (c.timeCapSeconds ?? 0) > 0;
      case 'Tabata':
        return (c.workSeconds ?? 0) > 0 && (c.restSeconds ?? 0) > 0 && (c.totalRounds ?? 0) > 0;
      default:
        return true;
    }
  })();
  // Per-exercise set requirements depend on the format:
  //   Standard          → every set needs reps + rest (weight stays optional —
  //                       bodyweight exercises legitimately have none).
  //   EMOM/AMRAP        → single round, reps required (weight optional).
  //   Tabata            → no required fields (each interval is for time;
  //                       reps don't apply, weight is optional).
  //   ForTime           → single round, reps required.
  const exerciseSetsReady = exercises.every((row) => {
    if (row.sets.length === 0) return false;
    if (format === 'Standard') {
      return row.sets.every((s) => s.reps !== '' && s.restSeconds !== '');
    }
    if (format === 'Tabata') {
      return true;
    }
    return row.sets[0].reps !== '';
  });
  // ForTime workouts can stand on their own (e.g. "Running" with just a time
  // cap) — no exercises required. All other formats need at least one.
  const exercisesRequirementMet = format === 'ForTime' || exercises.length > 0;
  const canSave =
    name.trim() !== '' &&
    formatConfigReady &&
    exercisesRequirementMet &&
    exerciseSetsReady;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        style={{ animation: 'dlg-fade-in .4s ease-out' }}
      />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[2vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{
            width: 680,
            maxWidth: '95vw',
            height: '92vh',
            maxHeight: '96vh',
            background: 'var(--bg)',
            borderRadius: 10,
            animation: 'dlg-slide-up .4s ease-out',
          }}
        >
          {/* Hero */}
          <div
            className="flex items-center justify-center"
            style={{ height: 120, background: 'var(--bg3)', position: 'relative', overflow: 'hidden' }}
          >
            <span style={{ fontSize: 48, opacity: 0.2 }}>📋</span>
            <button
              onClick={onClose}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
              aria-label={t('common.close')}
              style={{ border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>

          {/* Header — name input + format dropdown */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <input
              id="workout-dialog-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('training.template.namePlaceholder')}
              aria-label={t('training.template.nameAriaLabel')}
              className="flex-1 text-[15px] font-semibold bg-transparent border-none outline-none text-text placeholder:text-text3"
              autoFocus
            />
            <select
              value={format}
              onChange={(e) => handleFormatChange(e.target.value as WorkoutFormat)}
              className="rounded-md border border-border bg-bg2 px-2.5 py-1 text-[13px] text-text outline-none focus:border-border-hv cursor-pointer"
              aria-label={t('training.template.colFormat')}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`training.format.${FORMAT_LABEL_KEYS[f]}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Body — pinned settings on top, scrollable exercises list below */}
          <div ref={bodyRef} className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-text3">{t('common.loading')}</div>
            ) : (
              <>
                {/* Pinned settings — format config, notes, exercise picker */}
                <div className="shrink-0 flex flex-col gap-4 px-5 pt-3 pb-2">
                  {/* Format-config inputs (non-Standard only) */}
                  {format !== 'Standard' && (
                    <div className="rounded-md border border-border overflow-hidden">
                      <SectionFormatConfigRow
                        format={format}
                        formatConfig={formatConfig}
                        onChange={(patch) => setFormatConfig({ ...(formatConfig ?? {}), ...patch })}
                      />
                    </div>
                  )}

                  {/* Workout-level notes */}
                  <div>
                    <label htmlFor="workout-dialog-notes" className="mb-1.5 block text-xs font-medium text-text3">
                      {t('training.template.notesLabel')}
                    </label>
                    <input
                      id="workout-dialog-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('training.template.notesPlaceholder')}
                      className={INPUT_CLASS_SM}
                    />
                  </div>

                  {/* Exercises label + search */}
                  <div>
                    <label htmlFor="workout-dialog-exercise-search" className="mb-1.5 block text-xs font-medium text-text3">
                      {t('training.template.colExercises')}
                    </label>
                    <div className="relative">
                      <input
                        id="workout-dialog-exercise-search"
                        value={exQuery}
                        onChange={(e) => setExQuery(e.target.value)}
                        onFocus={() => setExFocused(true)}
                        onBlur={() => setExFocused(false)}
                        placeholder={t('exercises.search')}
                        aria-label={t('training.template.exerciseSearchAriaLabel')}
                        className={`${INPUT_CLASS_SM} pl-8`}
                      />
                      <svg
                        className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {exFocused && exResults.length > 0 && (
                        <div
                          className="absolute z-10 mt-1 max-h-[60vh] w-full overflow-y-auto rounded-md border border-border bg-bg2 shadow-lg"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {exResults.map((ex) => {
                            const added = exercises.some((r) => r.exerciseExternalId === ex.exerciseId);
                            const diffLevel =
                              ex.difficulty === 'Beginner' ? 1
                                : ex.difficulty === 'Intermediate' ? 2
                                : ex.difficulty === 'Advanced' ? 3
                                : 0;
                            const diffColor =
                              ex.difficulty === 'Beginner' ? 'var(--green)'
                                : ex.difficulty === 'Intermediate' ? 'var(--orange)'
                                : 'var(--red)';
                            return (
                              <button
                                key={ex.exerciseId}
                                type="button"
                                disabled={added}
                                onClick={() => addExercise(ex)}
                                className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition-colors ${
                                  added ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{ex.name}</div>
                                  {ex.muscleGroups && ex.muscleGroups.length > 0 && (
                                    <div className="mt-[2px] flex flex-wrap gap-1">
                                      {ex.muscleGroups.map((g) => (
                                        <span
                                          key={g}
                                          className="rounded-sm px-[5px] py-[1px] text-[10px] font-medium"
                                          style={{
                                            background: MUSCLE_BG_COLORS[g] ?? 'var(--accent-bg)',
                                            color: MUSCLE_COLORS[g] ?? 'var(--accent)',
                                          }}
                                        >
                                          {t(`enums.muscleGroup.${g}`)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {diffLevel > 0 && (
                                  <div className="flex items-center gap-[2px] shrink-0" aria-hidden="true">
                                    {[1, 2, 3].map((level) => (
                                      <div
                                        key={level}
                                        className="rounded-full"
                                        style={{
                                          width: 12,
                                          height: 4,
                                          background: level <= diffLevel ? diffColor : 'var(--bg3)',
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable exercise list — only this region scrolls. */}
                <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ minHeight: 0 }}>
                  {exercises.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {exercises.map((row, exIdx) => (
                        <div
                          key={`${row.exerciseExternalId}-${exIdx}`}
                          className="rounded-md border border-border bg-bg overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-bg2">
                            <span className="flex-1 truncate text-[13px] font-semibold text-text">
                              {row.exerciseName}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeExercise(exIdx)}
                              className="text-text4 hover:text-red transition-colors text-sm"
                              aria-label={t('common.delete')}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Per-exercise notes (single line, expands as needed) */}
                          <div className="px-2.5 pt-1.5">
                            <input
                              value={row.notes}
                              onChange={(e) => updateExerciseNotes(exIdx, e.target.value)}
                              placeholder={t('training.template.exerciseNotesPlaceholder')}
                              aria-label={t('training.exerciseNotesAriaLabel')}
                              className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[12px] text-text2 outline-none placeholder:text-text4 hover:border-border focus:border-border-hv focus:bg-bg2"
                            />
                          </div>

                          {format === 'Standard' ? (
                            <div className="px-2 py-1.5">
                              <table className="w-full border-collapse text-[13px]">
                                <thead>
                                  <tr className="text-[10px] font-medium uppercase tracking-wider text-text3">
                                    <th className="px-1 py-1 w-7 text-center">#</th>
                                    <th className="px-1 py-1 text-center">{t('training.repsLabel')}</th>
                                    <th className="px-1 py-1 text-center">{t('training.weightLabel')} (kg)</th>
                                    <th className="px-1 py-1 text-center">{t('training.restSecondsLabel')}</th>
                                    <th className="px-1 py-1 w-7" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.sets.map((set, setIdx) => (
                                    <tr key={setIdx} className="group">
                                      <td className="px-1 py-1 text-center text-[12px] text-text3 tabular-nums">
                                        {setIdx + 1}
                                      </td>
                                      <td className="px-1 py-1">
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={set.reps}
                                          aria-label={t('training.setRepsAriaLabel', { setNumber: setIdx + 1 })}
                                          onChange={(e) =>
                                            updateSet(exIdx, setIdx, {
                                              reps: e.target.value === '' ? '' : Number(e.target.value),
                                            })
                                          }
                                          className="w-full rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv"
                                        />
                                      </td>
                                      <td className="px-1 py-1">
                                        <input
                                          type="number"
                                          min={0}
                                          step={0.5}
                                          value={set.weightKg}
                                          aria-label={t('training.setWeightAriaLabel', { setNumber: setIdx + 1 })}
                                          onChange={(e) =>
                                            updateSet(exIdx, setIdx, {
                                              weightKg: e.target.value === '' ? '' : Number(e.target.value),
                                            })
                                          }
                                          className="w-full rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv"
                                        />
                                      </td>
                                      <td className="px-1 py-1">
                                        <input
                                          type="number"
                                          min={0}
                                          step={5}
                                          value={set.restSeconds}
                                          aria-label={t('training.setRestAriaLabel', { setNumber: setIdx + 1 })}
                                          onChange={(e) =>
                                            updateSet(exIdx, setIdx, {
                                              restSeconds: e.target.value === '' ? '' : Number(e.target.value),
                                            })
                                          }
                                          className="w-full rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv"
                                        />
                                      </td>
                                      <td className="px-1 py-1 text-center">
                                        {row.sets.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeSet(exIdx, setIdx)}
                                            className="text-text4 hover:text-red transition-colors text-xs opacity-0 group-hover:opacity-100"
                                            aria-label={t('common.delete')}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <button
                                type="button"
                                onClick={() => addSet(exIdx)}
                                className="mt-1 text-[11px] text-text4 transition-colors hover:text-text2"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' }}
                              >
                                + {t('training.addSet')}
                              </button>
                            </div>
                          ) : (
                            <div className="px-2.5 py-1.5">
                              <div className="flex flex-wrap items-center gap-3">
                                {/* Reps — hidden for Tabata (each work interval is for time, not a rep target). */}
                                {format !== 'Tabata' && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="text-[11px] font-medium uppercase text-text3">
                                      {t('training.repsLabel')}
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={row.sets[0]?.reps ?? ''}
                                      aria-label={t('training.wodRepsAriaLabel')}
                                      onChange={(e) =>
                                        updateSet(exIdx, 0, {
                                          reps: e.target.value === '' ? '' : Number(e.target.value),
                                        })
                                      }
                                      className="w-16 rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv"
                                    />
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium uppercase text-text3">
                                    {t('training.weightLabel')}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={row.sets[0]?.weightKg ?? ''}
                                    aria-label={t('training.wodWeightAriaLabel')}
                                    onChange={(e) =>
                                      updateSet(exIdx, 0, {
                                        weightKg: e.target.value === '' ? '' : Number(e.target.value),
                                      })
                                    }
                                    className="w-16 rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv"
                                  />
                                  <span className="text-[11px] text-text4">kg</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[12px] text-text3">
                      {t('training.template.noExercisesHint')}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? t('common.saving') : isNew ? t('common.create') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
