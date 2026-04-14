import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchExercises, createExercise, updateExercise, deleteExercise } from '@/api/exercises';
import type { CreateExerciseRequest, ExerciseSummary, MuscleGroup, ExerciseEquipment, ExerciseCategory, ExerciseDifficulty } from '@/api/exercise-types';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { PageHeader } from '@/components/layout';
import { Button, Dialog } from '@/components/ui';
import { Pagination } from '@/components/data';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { INPUT_CLASS } from '@/lib/styles';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const muscleGroupColors: Record<string, string> = {
  Chest: 'bg-red-500/15 text-red-400',
  Back: 'bg-blue-500/15 text-blue-400',
  Shoulders: 'bg-orange-500/15 text-orange-400',
  Biceps: 'bg-purple-500/15 text-purple-400',
  Triceps: 'bg-pink-500/15 text-pink-400',
  Quadriceps: 'bg-green-500/15 text-green-400',
  Hamstrings: 'bg-emerald-500/15 text-emerald-400',
  Glutes: 'bg-teal-500/15 text-teal-400',
  Abs: 'bg-yellow-500/15 text-yellow-400',
  Cardio: 'bg-cyan-500/15 text-cyan-400',
};

const allMuscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Obliques', 'LowerBack', 'Traps', 'FullBody'];
const allEquipment: ExerciseEquipment[] = ['None', 'Dumbbells', 'Barbell', 'Machine', 'TRX', 'Kettlebell', 'Bodyweight'];
const allCategories: ExerciseCategory[] = ['Strength', 'Cardio', 'Mobility', 'Technique', 'Warmup'];
const allDifficulties: ExerciseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

const filterClass = 'rounded-sm border border-border bg-bg2 px-3 py-2 text-sm text-text outline-none';

export default function ExercisesPage() {
  const { t } = useTranslation();

  const sortedByLabel = <T extends string>(items: T[], prefix: string): T[] =>
    [...items].sort((a, b) => t(`${prefix}.${a}`).localeCompare(t(`${prefix}.${b}`)));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  // Exercise dialog (add / edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localesOpen, setLocalesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseSummary | null>(null);
  const emptyForm: CreateExerciseRequest = { name: '', nameEn: '', nameCs: '', nameDe: '', muscleGroups: [], equipment: '' as ExerciseEquipment, category: '' as ExerciseCategory, difficulty: '' as ExerciseDifficulty, techniqueNotes: '' };
  const [form, setForm] = useState<CreateExerciseRequest>(emptyForm);

  const openNewDialog = useCallback(() => {
    setEditingExercise(null);
    setForm({ ...emptyForm });
    setLocalesOpen(false);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((exercise: ExerciseSummary) => {
    setEditingExercise(exercise);
    setForm({
      name: exercise.rawName || exercise.name,
      nameEn: exercise.nameEn ?? '',
      nameCs: exercise.nameCs ?? '',
      nameDe: exercise.nameDe ?? '',
      muscleGroups: exercise.muscleGroups ?? [],
      equipment: exercise.equipment,
      category: exercise.category,
      difficulty: exercise.difficulty,
      techniqueNotes: '',
    });
    setLocalesOpen(false);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingExercise(null);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exercises', debouncedSearch, muscleGroup, equipment, category, difficulty, page],
    queryFn: () =>
      searchExercises({
        q: debouncedSearch || undefined,
        muscleGroup: (muscleGroup || undefined) as MuscleGroup | undefined,
        equipment: (equipment || undefined) as ExerciseEquipment | undefined,
        category: (category || undefined) as ExerciseCategory | undefined,
        difficulty: (difficulty || undefined) as ExerciseDifficulty | undefined,
        page,
        pageSize: 20,
      }),
  });

  const deleteMutation = useApiMutation(deleteExercise, {
    successKey: 'exercises.deleted',
    errorKey: 'exercises.deleteError',
    onSuccess: () => refetch(),
  });

  const confirmDelete = useConfirmDelete(deleteMutation);

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.muscleGroups.length === 0) return;
    setSaving(true);
    try {
      if (editingExercise) {
        await updateExercise(editingExercise.exerciseId, form);
        showSuccess('exercises.updated');
      } else {
        await createExercise(form);
        showSuccess('exercises.created');
      }
      closeDialog();
      refetch();
    } catch (err) {
      showApiError(err, editingExercise ? 'exercises.updateError' : 'exercises.createError');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, exercise: ExerciseSummary) => {
    e.stopPropagation();
    confirmDelete.requestDelete(exercise.exerciseId, exercise.name);
  };

  const toggleMuscleGroup = (mg: MuscleGroup) => {
    setForm((prev) => ({
      ...prev,
      muscleGroups: prev.muscleGroups.includes(mg)
        ? prev.muscleGroups.filter((g) => g !== mg)
        : [...prev.muscleGroups, mg],
    }));
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="💪"
        title={t('exercises.title')}
        subtitle={t('exercises.subtitle')}
        actions={
          <Button variant="primary" onClick={openNewDialog}>
            + {t('exercises.addExercise')}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search / filter bar */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('exercises.search')}
              className="w-full rounded-md border border-border-md bg-bg px-4 py-2.5 pl-10 text-sm text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv"
            />
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select value={muscleGroup} onChange={(e) => { setMuscleGroup(e.target.value); setPage(1); }} className={filterClass}>
            <option value="">{t('exercises.allMuscleGroups')}</option>
            {sortedByLabel(allMuscleGroups, 'enums.muscleGroup').map((mg) => <option key={mg} value={mg}>{t(`enums.muscleGroup.${mg}`)}</option>)}
          </select>
          <select value={equipment} onChange={(e) => { setEquipment(e.target.value); setPage(1); }} className={filterClass}>
            <option value="">{t('exercises.allEquipment')}</option>
            {sortedByLabel(allEquipment, 'enums.equipment').map((eq) => <option key={eq} value={eq}>{t(`enums.equipment.${eq}`)}</option>)}
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={filterClass}>
            <option value="">{t('exercises.allCategories')}</option>
            {sortedByLabel(allCategories, 'enums.category').map((c) => <option key={c} value={c}>{t(`enums.category.${c}`)}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }} className={filterClass}>
            <option value="">{t('exercises.allDifficulties')}</option>
            {sortedByLabel(allDifficulties, 'enums.difficulty').map((d) => <option key={d} value={d}>{t(`enums.difficulty.${d}`)}</option>)}
          </select>
        </div>

        {/* Exercises table */}
        <div className="rounded-sm border border-border bg-bg2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.exercises?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F3CB;</span>
              <p className="mt-3 text-sm">{t('exercises.noExercises')}</p>
              <p className="mt-1 text-xs text-text3">{t('exercises.noExercisesHint')}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_180px_100px_100px_100px_60px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('exercises.exerciseName')}</span>
                <span className="lbl">{t('exercises.muscleGroups')}</span>
                <span className="lbl">{t('exercises.equipment')}</span>
                <span className="lbl">{t('exercises.category')}</span>
                <span className="lbl">{t('exercises.difficulty')}</span>
                <span className="lbl" />
              </div>

              {/* Rows */}
              {data.exercises.map((exercise) => (
                <div
                  key={exercise.exerciseId}
                  onClick={() => openEditDialog(exercise)}
                  className="grid grid-cols-[1fr_180px_100px_100px_100px_60px] cursor-pointer items-center gap-4 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-bg-hover"
                >
                  <span className="truncate text-sm font-semibold">{exercise.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {exercise.muscleGroups?.map((mg) => (
                      <span
                        key={mg}
                        className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${muscleGroupColors[mg] ?? 'bg-bg3 text-text3'}`}
                      >
                        {t(`enums.muscleGroup.${mg}`)}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-text2">{exercise.equipment ? t(`enums.equipment.${exercise.equipment}`) : '-'}</span>
                  <span className="text-sm text-text2">{exercise.category ? t(`enums.category.${exercise.category}`) : '-'}</span>
                  <span className="text-sm text-text2">{exercise.difficulty ? t(`enums.difficulty.${exercise.difficulty}`) : '-'}</span>
                  <div className="text-center">
                    {exercise.isCustom && (
                      <button
                        onClick={(e) => handleDeleteClick(e, exercise)}
                        disabled={deleteMutation.isPending}
                        className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:opacity-30"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <Pagination page={page} totalPages={totalPages} totalCount={data.totalCount} onPageChange={setPage} className="border-t border-border px-5 py-3" />
            </>
          )}
        </div>
      </div>

      {/* Add / Edit exercise dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editingExercise ? t('exercises.editExercise') : t('exercises.addExercise')}
        maxWidth={520}
        footer={
          <Button
            variant="primary"
            onClick={handleSubmit as any}
            disabled={saving || !form.name.trim() || form.muscleGroups.length === 0}
          >
            {saving ? t('common.saving') : editingExercise ? t('exercises.saveChanges') : t('exercises.addExercise')}
          </Button>
        }
      >
        <form id="exercise-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-text3">{t('exercises.exerciseName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('exercises.namePlaceholder')}
              required
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>

          {/* Localized names (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setLocalesOpen(!localesOpen)}
              className="flex items-center gap-1 text-xs text-text3 transition-colors hover:text-text"
            >
              <svg className={`h-3 w-3 transition-transform ${localesOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t('exercises.localizedNames')}
            </button>
            {localesOpen && (
              <div className="mt-2 flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text3">{t('exercises.nameEn')}</label>
                  <input type="text" value={form.nameEn ?? ''} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder={t('exercises.nameEnPlaceholder')} className={`w-full ${INPUT_CLASS}`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text3">{t('exercises.nameCs')}</label>
                  <input type="text" value={form.nameCs ?? ''} onChange={(e) => setForm({ ...form, nameCs: e.target.value })} placeholder={t('exercises.nameCsPlaceholder')} className={`w-full ${INPUT_CLASS}`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text3">{t('exercises.nameDe')}</label>
                  <input type="text" value={form.nameDe ?? ''} onChange={(e) => setForm({ ...form, nameDe: e.target.value })} placeholder={t('exercises.nameDePlaceholder')} className={`w-full ${INPUT_CLASS}`} />
                </div>
              </div>
            )}
          </div>

          {/* Muscle Groups */}
          <div>
            <label className="mb-2 block text-xs text-text3">{t('exercises.muscleGroups')}</label>
            <div className="flex flex-wrap gap-2">
              {sortedByLabel(allMuscleGroups, 'enums.muscleGroup').map((mg) => (
                <label key={mg} className="flex cursor-pointer items-center gap-1.5 text-sm text-text2">
                  <input
                    type="checkbox"
                    checked={form.muscleGroups.includes(mg)}
                    onChange={() => toggleMuscleGroup(mg)}
                    className="accent-accent"
                  />
                  {t(`enums.muscleGroup.${mg}`)}
                </label>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="mb-1 block text-xs text-text3">{t('exercises.equipment')}</label>
            <select value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value as ExerciseEquipment })} className={`w-full ${INPUT_CLASS}`}>
              <option value="">{t('exercises.selectEquipment')}</option>
              {sortedByLabel(allEquipment, 'enums.equipment').map((eq) => <option key={eq} value={eq}>{t(`enums.equipment.${eq}`)}</option>)}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs text-text3">{t('exercises.category')}</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExerciseCategory })} className={`w-full ${INPUT_CLASS}`}>
              <option value="">{t('exercises.selectCategory')}</option>
              {sortedByLabel(allCategories, 'enums.category').map((c) => <option key={c} value={c}>{t(`enums.category.${c}`)}</option>)}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-1 block text-xs text-text3">{t('exercises.difficulty')}</label>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as ExerciseDifficulty })} className={`w-full ${INPUT_CLASS}`}>
              <option value="">{t('exercises.selectDifficulty')}</option>
              {sortedByLabel(allDifficulties, 'enums.difficulty').map((d) => <option key={d} value={d}>{t(`enums.difficulty.${d}`)}</option>)}
            </select>
          </div>

          {/* Technique Notes */}
          <div>
            <label className="mb-1 block text-xs text-text3">{t('exercises.techniqueNotes')}</label>
            <textarea
              value={form.techniqueNotes ?? ''}
              onChange={(e) => setForm({ ...form, techniqueNotes: e.target.value })}
              rows={4}
              placeholder={t('exercises.techniqueNotesPlaceholder')}
              className={`w-full resize-none ${INPUT_CLASS}`}
            />
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete.target}
        name={confirmDelete.target?.name ?? ''}
        isPending={confirmDelete.isPending}
        onConfirm={confirmDelete.confirmDelete}
        onCancel={confirmDelete.cancelDelete}
        title={t('exercises.deleteConfirmTitle')}
        message={confirmDelete.target ? t('exercises.deleteConfirmMessage', { name: confirmDelete.target.name }) : undefined}
      />
    </div>
  );
}
