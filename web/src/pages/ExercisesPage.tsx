import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchExercises, createExercise, updateExercise, deleteExercise } from '@/api/exercises';
import type { CreateExerciseRequest, ExerciseSummary, MuscleGroup, ExerciseEquipment, ExerciseCategory, ExerciseDifficulty } from '@/api/exercise-types';
import { showApiError, showSuccess, getRfc7807ErrorCode } from '@/lib/api-errors';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { PageHeader, Toolbar } from '@/components/layout';
import type { ToolbarView } from '@/components/layout';
import { Button, Dialog, SearchInput } from '@/components/ui';
import { Pagination, ListView, CardGrid, Card, CardBody, CardPropRow, DatabaseTable } from '@/components/data';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { INPUT_CLASS } from '@/lib/styles';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { MUSCLE_BG_COLORS, MUSCLE_COLORS } from '@/constants/training';

const allMuscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Obliques', 'LowerBack', 'Traps', 'FullBody'];
const allEquipment: ExerciseEquipment[] = ['None', 'Dumbbells', 'Barbell', 'Machine', 'TRX', 'Kettlebell', 'Bodyweight'];
const allCategories: ExerciseCategory[] = ['Strength', 'Cardio', 'Mobility', 'Technique', 'Warmup'];
const allDifficulties: ExerciseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

const filterClass = 'rounded-md border border-border-md bg-bg px-3 py-[6px] text-[13px] text-text outline-none transition-colors focus:border-border-hv';

export default function ExercisesPage() {
  const { t } = useTranslation();

  const sortedByLabel = <T extends string>(items: T[], prefix: string): T[] =>
    [...items].sort((a, b) => t(`${prefix}.${a}`).localeCompare(t(`${prefix}.${b}`)));

  type ViewType = 'table' | 'list' | 'cards';
  const [view, setView] = useState<ViewType>('table');
  const VIEWS: ToolbarView[] = [
    { id: 'table', label: t('common.viewTable'), icon: '⊞' },
    { id: 'list',  label: t('common.viewList'),  icon: '☰' },
    { id: 'cards', label: t('common.viewCards'), icon: '⬜' },
  ];

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

  const deleteMutation = useApiMutation(
    ({ exerciseId, version }: { exerciseId: string; version: number }) =>
      deleteExercise(exerciseId, version),
    {
      successKey: 'exercises.deleted',
      onSuccess: () => refetch(),
      onError: (error) => {
        if (getRfc7807ErrorCode(error) === 'EXERCISE_VERSION_CONFLICT') {
          showApiError(error, 'exercises.deleteError');
          refetch();
        } else {
          showApiError(error, 'exercises.deleteError');
        }
      },
    },
  );

  const confirmDelete = useConfirmDelete<{ exerciseId: string; version: number }>(deleteMutation);

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.muscleGroups.length === 0) return;
    setSaving(true);
    try {
      if (editingExercise) {
        await updateExercise(editingExercise.exerciseId, { ...form, version: editingExercise.version });
        showSuccess('exercises.updated');
        closeDialog();
        refetch();
      } else {
        await createExercise(form);
        showSuccess('exercises.created');
        closeDialog();
        refetch();
      }
    } catch (err) {
      if (getRfc7807ErrorCode(err) === 'EXERCISE_VERSION_CONFLICT') {
        showApiError(err, 'exercises.updateError');
        // Reload to give the user the latest version so they can retry.
        refetch();
      } else {
        showApiError(err, editingExercise ? 'exercises.updateError' : 'exercises.createError');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, exercise: ExerciseSummary) => {
    e.stopPropagation();
    confirmDelete.requestDelete({ exerciseId: exercise.exerciseId, version: exercise.version }, exercise.name);
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

      <Toolbar
        views={VIEWS}
        activeView={view}
        onViewChange={(id) => setView(id as ViewType)}
        className="px-6 py-1.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder={t('exercises.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[240px]"
          />
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
      </Toolbar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-3">
        {/* Exercises content — branches on view (table / list / cards) */}
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
        ) : view === 'table' ? (
          <>
            <DatabaseTable
              columns={[
                {
                  key: 'icon', label: '', width: '52px',
                  render: () => (
                    <div className="h-10 w-10 rounded-sm bg-bg3 flex items-center justify-center text-sm shrink-0" aria-hidden="true">
                      🏋️
                    </div>
                  ),
                },
                { key: 'name', label: t('exercises.exerciseName'), render: (ex) => ex.name },
                {
                  key: 'muscleGroups', label: t('exercises.muscleGroups'), width: '180px',
                  render: (ex) => (
                    <div className="flex flex-wrap gap-1">
                      {ex.muscleGroups?.map((mg) => (
                        <span
                          key={mg}
                          className="inline-flex rounded-sm px-1.5 py-[1px] text-[10px] font-semibold"
                          style={{ background: MUSCLE_BG_COLORS[mg] ?? 'var(--bg3)', color: MUSCLE_COLORS[mg] ?? 'var(--text3)' }}
                        >
                          {t(`enums.muscleGroup.${mg}`)}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'equipment', label: t('exercises.equipment'), width: '110px',
                  render: (ex) => <span className="text-text3">{ex.equipment ? t(`enums.equipment.${ex.equipment}`) : '—'}</span>,
                },
                {
                  key: 'category', label: t('exercises.category'), width: '110px',
                  render: (ex) => <span className="text-text3">{ex.category ? t(`enums.category.${ex.category}`) : '—'}</span>,
                },
                {
                  key: 'difficulty', label: t('exercises.difficulty'), width: '110px',
                  render: (ex) => <span className="text-text3">{ex.difficulty ? t(`enums.difficulty.${ex.difficulty}`) : '—'}</span>,
                },
              ]}
              rows={data.exercises}
              rowKey={(ex) => ex.exerciseId}
              onRowClick={(ex) => openEditDialog(ex)}
              renderRowActions={(ex) =>
                ex.isCustom ? (
                  <button
                    onClick={(e) => handleDeleteClick(e, ex)}
                    disabled={deleteMutation.isPending}
                    title={t('common.delete')}
                    className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : null
              }
            />
            <Pagination page={page} totalPages={totalPages} totalCount={data.totalCount} onPageChange={setPage} className="mt-3" />
          </>
        ) : view === 'list' ? (
          <>
            <ListView
              items={data.exercises}
              itemKey={(ex) => ex.exerciseId}
              onItemClick={(ex) => openEditDialog(ex)}
              renderAvatar={() => (
                <div className="w-10 h-10 rounded-sm flex items-center justify-center text-sm shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  🏋️
                </div>
              )}
              renderInfo={(ex) => (
                <div>
                  <div className="text-[13px] font-medium text-text truncate">{ex.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {ex.muscleGroups?.map((mg) => (
                      <span
                        key={mg}
                        className="inline-flex rounded-sm px-1.5 py-[1px] text-[10px] font-semibold"
                        style={{ background: MUSCLE_BG_COLORS[mg] ?? 'var(--bg3)', color: MUSCLE_COLORS[mg] ?? 'var(--text3)' }}
                      >
                        {t(`enums.muscleGroup.${mg}`)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              renderRight={(ex) => (
                <>
                  {ex.equipment && <span className="text-[11px] text-text3">{t(`enums.equipment.${ex.equipment}`)}</span>}
                  {ex.difficulty && <span className="text-[11px] text-text3">· {t(`enums.difficulty.${ex.difficulty}`)}</span>}
                </>
              )}
              renderActions={(ex) =>
                ex.isCustom ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, ex); }}
                    className="rounded-sm p-1 text-text3 transition-colors hover:text-red"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : null
              }
            />
            <Pagination page={page} totalPages={totalPages} totalCount={data.totalCount} onPageChange={setPage} className="mt-3" />
          </>
        ) : (
          <>
            <CardGrid>
              {data.exercises.map((ex) => (
                <Card key={ex.exerciseId} onClick={() => openEditDialog(ex)}>
                  {/* Tall cover area with emoji + name overlay */}
                  <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
                      🏋️
                    </div>
                    {/* Difficulty chip — top-right */}
                    {ex.difficulty && (
                      <div className="absolute top-2 right-2 inline-flex items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm px-2 py-0.5 text-[11px] font-medium text-text">
                        {t(`enums.difficulty.${ex.difficulty}`)}
                      </div>
                    )}
                    {/* Gradient + name overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
                      <div className="truncate text-[13px] font-bold text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                        {ex.name}
                      </div>
                    </div>
                  </div>
                  <CardBody>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {ex.muscleGroups?.map((mg) => (
                        <span
                          key={mg}
                          className="inline-flex rounded-sm px-1.5 py-[1px] text-[10px] font-semibold"
                          style={{ background: MUSCLE_BG_COLORS[mg] ?? 'var(--bg3)', color: MUSCLE_COLORS[mg] ?? 'var(--text3)' }}
                        >
                          {t(`enums.muscleGroup.${mg}`)}
                        </span>
                      ))}
                    </div>
                    {ex.equipment && (
                      <CardPropRow label={t('exercises.equipment')}>
                        {t(`enums.equipment.${ex.equipment}`)}
                      </CardPropRow>
                    )}
                    {ex.category && (
                      <CardPropRow label={t('exercises.category')}>
                        {t(`enums.category.${ex.category}`)}
                      </CardPropRow>
                    )}
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
            <Pagination page={page} totalPages={totalPages} totalCount={data.totalCount} onPageChange={setPage} className="mt-3" />
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
            onClick={handleSubmit}
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
