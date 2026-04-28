import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchRecipes, deleteRecipe } from '@/api/recipes';
import type { RecipeSummary } from '@/api/recipe-types';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { RecipeDialog } from '@/components/nutrition/RecipeDialog';
import { PageHeader, Toolbar } from '@/components/layout';
import { Button, SearchInput } from '@/components/ui';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { DatabaseTable, ListView, CardGrid, Card, CardBody, CardPropRow, MacroBadges, Pagination } from '@/components/data';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDialogState } from '@/hooks/useDialogState';

type ViewType = 'table' | 'list' | 'cards';
type SortKey = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'prepTime';
type SortDir = 'asc' | 'desc';

export default function RecipesPage() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewType>('table');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const recipeDialog = useDialogState<RecipeSummary>();

  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recipes', debouncedSearch, page],
    queryFn: () => searchRecipes({ search: debouncedSearch || undefined, page, pageSize: 50 }),
  });

  const deleteMutation = useApiMutation(deleteRecipe, {
    successKey: 'recipes.deleted',
    errorKey: 'recipes.deleteError',
    onSuccess: () => refetch(),
  });

  const confirmDelete = useConfirmDelete(deleteMutation);

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const sortedRecipes = useMemo(() => {
    const recipes = [...(data?.recipes ?? [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    recipes.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'kcal': cmp = a.totalNutrients.kcal - b.totalNutrients.kcal; break;
        case 'protein': cmp = a.totalNutrients.protein - b.totalNutrients.protein; break;
        case 'carbs': cmp = a.totalNutrients.carbs - b.totalNutrients.carbs; break;
        case 'fat': cmp = a.totalNutrients.fat - b.totalNutrients.fat; break;
        case 'fiber': cmp = (a.totalNutrients.fiber ?? 0) - (b.totalNutrients.fiber ?? 0); break;
        case 'prepTime': cmp = (a.prepTimeMinutes ?? 0) - (b.prepTimeMinutes ?? 0); break;
      }
      return cmp * dir;
    });
    return recipes;
  }, [data?.recipes, sortKey, sortDir]);

  const handleDeleteClick = (e: React.MouseEvent, recipe: RecipeSummary) => {
    e.stopPropagation();
    confirmDelete.requestDelete(recipe.recipeId, recipe.name);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setShowSortMenu(false);
  };

  const views = [
    { id: 'table', label: t('recipes.viewTable'), icon: '⊞' },
    { id: 'list', label: t('recipes.viewList'), icon: '☰' },
    { id: 'cards', label: t('recipes.viewCards'), icon: '⬜' },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'name', label: t('recipes.recipeName') },
    { key: 'kcal', label: 'kcal' },
    { key: 'protein', label: t('foods.protein') },
    { key: 'carbs', label: t('foods.carbs') },
    { key: 'fat', label: t('foods.fat') },
    { key: 'fiber', label: t('foods.fiber') },
    { key: 'prepTime', label: t('recipes.prepTime') },
  ];

  const deleteBtn = (recipe: RecipeSummary) => (
    <button onClick={(e) => handleDeleteClick(e, recipe)} disabled={deleteMutation.isPending}
      className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:opacity-30">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  const pagination = <Pagination page={page} totalPages={totalPages} totalCount={data?.totalCount ?? 0} onPageChange={setPage} className="mt-3" />;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="📖"
        title={t('recipes.pageTitle')}
        subtitle={t('recipes.pageSubtitle')}
        actions={<Button variant="primary" onClick={() => recipeDialog.openNew()}>+ {t('recipes.addRecipe')}</Button>}
      />
      <Toolbar views={views} activeView={view} onViewChange={(v) => setView(v as ViewType)}>
        <SearchInput placeholder={t('recipes.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-[240px]" />
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setShowSortMenu((v) => !v)}>↕ {t('recipes.sort')}</Button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-bg2 border border-border rounded-md shadow-lg py-1 min-w-[160px]">
                {sortOptions.map((opt) => (
                  <button key={opt.key} onClick={() => handleSort(opt.key)}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors flex items-center justify-between"
                    style={{ color: sortKey === opt.key ? 'var(--accent)' : 'var(--text)' }}>
                    {opt.label}
                    {sortKey === opt.key && <span className="text-[10px] ml-2">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Toolbar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">{t('common.loading')}</div>
          ) : !sortedRecipes.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">🍳</span>
              <p className="mt-3 text-sm">{t('recipes.noRecipes')}</p>
              <p className="mt-1 text-xs text-text3">{t('recipes.noRecipesHint')}</p>
            </div>
          ) : view === 'table' ? (
            <>
              <DatabaseTable
                columns={[
                  {
                    key: 'image', label: '', width: '52px',
                    render: (r: RecipeSummary) => r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="h-10 w-10 rounded-sm object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-sm bg-bg3 flex items-center justify-center text-sm shrink-0" aria-hidden="true">
                        📖
                      </div>
                    ),
                  },
                  { key: 'name', label: t('recipes.recipeName'), render: (r: RecipeSummary) => r.name },
                  { key: 'prepTime', label: t('recipes.prepTime'), width: '80px', render: (r: RecipeSummary) => <span className="text-text3">{r.prepTimeMinutes ? `${r.prepTimeMinutes} min` : '—'}</span> },
                  { key: 'kcal', label: 'kcal', width: '80px', render: (r: RecipeSummary) => <span className="tabular-nums">{Math.round(r.totalNutrients.kcal)}</span> },
                  { key: 'protein', label: t('nutrition.proteinShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(r.totalNutrients.protein)}g</span> },
                  { key: 'carbs', label: t('nutrition.carbsShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(r.totalNutrients.carbs)}g</span> },
                  { key: 'fat', label: t('nutrition.fatShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(r.totalNutrients.fat)}g</span> },
                  { key: 'fiber', label: t('nutrition.fiberShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--green)' }}>{Math.round(r.totalNutrients.fiber ?? 0)}g</span> },
                ]}
                rows={sortedRecipes}
                rowKey={(r) => r.recipeId}
                onRowClick={(r) => recipeDialog.openEdit(r)}
                renderRowActions={(r: RecipeSummary) => deleteBtn(r)}
              />
              {pagination}
            </>
          ) : view === 'list' ? (
            <>
              <ListView
                items={sortedRecipes}
                itemKey={(r) => r.recipeId}
                renderAvatar={(r) => r.imageUrl ? (
                  <img
                    src={r.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-10 h-10 rounded-sm object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center text-sm shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>📖</div>
                )}
                renderInfo={(r) => (
                  <div>
                    <div className="text-[13px] font-medium text-text truncate">{r.name}</div>
                    <div className="text-[11px] text-text3 flex items-center gap-2 mt-0.5">
                      {r.prepTimeMinutes && <span>{r.prepTimeMinutes} min</span>}
                      <span className="tabular-nums">{r.prepTimeMinutes ? '· ' : ''}{Math.round(r.totalNutrients.kcal)} kcal</span>
                    </div>
                  </div>
                )}
                renderRight={(r) => <MacroBadges nutrients={r.totalNutrients} round />}
                onItemClick={(r) => recipeDialog.openEdit(r)}
                renderActions={(r) => deleteBtn(r)}
              />
              {pagination}
            </>
          ) : (
            <CardGrid>
              {sortedRecipes.map((r) => (
                <Card key={r.recipeId} onClick={() => recipeDialog.openEdit(r)}>
                  {/* Taller image area with name overlay */}
                  <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
                        📖
                      </div>
                    )}
                    {/* Prep-time chip — top-right corner */}
                    {r.prepTimeMinutes && (
                      <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-sm shadow-sm px-2 py-0.5 text-[11px] font-medium text-text">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="12 7 12 12 15 14" />
                        </svg>
                        <span className="tabular-nums">{r.prepTimeMinutes} min</span>
                      </div>
                    )}
                    {/* Gradient + name overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
                      <div className="truncate text-[13px] font-bold text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                        {r.name}
                      </div>
                    </div>
                  </div>
                  <CardBody>
                    <CardPropRow label="kcal">{Math.round(r.totalNutrients.kcal)}</CardPropRow>
                    <CardPropRow label={`${t('nutrition.proteinShort')} / ${t('nutrition.carbsShort')} / ${t('nutrition.fatShort')} / ${t('nutrition.fiberShort')}`}><MacroBadges nutrients={r.totalNutrients} round /></CardPropRow>
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
          )}
        </div>
      </div>

      {/* Recipe dialog (view + edit in one) */}
      <RecipeDialog
        open={recipeDialog.isOpen}
        recipe={recipeDialog.item}
        onClose={recipeDialog.close}
        onSaved={() => refetch()}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete.target}
        name={confirmDelete.target?.name ?? ''}
        isPending={confirmDelete.isPending}
        onConfirm={confirmDelete.confirmDelete}
        onCancel={confirmDelete.cancelDelete}
        title={t('recipes.deleteConfirmTitle')}
        message={confirmDelete.target ? t('recipes.deleteConfirmMessage', { name: confirmDelete.target.name }) : undefined}
      />
    </div>
  );
}
