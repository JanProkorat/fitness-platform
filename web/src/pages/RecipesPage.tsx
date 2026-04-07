import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchRecipes, deleteRecipe } from '@/api/recipes';
import type { RecipeSummary } from '@/api/recipe-types';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { RecipeDialog } from '@/components/nutrition/RecipeDialog';
import { PageHeader, Toolbar } from '@/components/layout';
import { Button, Dialog, SearchInput } from '@/components/ui';
import { DatabaseTable, ListView, CardGrid, Card, CardCover, CardBody, CardPropRow } from '@/components/data';

type ViewType = 'table' | 'list' | 'cards';
type SortKey = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'foodCount' | 'prepTime';
type SortDir = 'asc' | 'desc';

function MacroBadges({ n }: { n: RecipeSummary['totalNutrients'] }) {
  return (
    <span className="text-[12px] tabular-nums">
      <span style={{ color: 'var(--blue)' }}>{Math.round(n.protein)}g</span>
      {' / '}
      <span style={{ color: 'var(--orange)' }}>{Math.round(n.carbs)}g</span>
      {' / '}
      <span style={{ color: 'var(--purple)' }}>{Math.round(n.fat)}g</span>
      {n.fiber ? <>{' / '}<span style={{ color: 'var(--green)' }}>{Math.round(n.fiber)}g</span></> : null}
    </span>
  );
}

export default function RecipesPage() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState<ViewType>('table');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dialogRecipe, setDialogRecipe] = useState<RecipeSummary | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ recipeId: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recipes', debouncedSearch, page],
    queryFn: () => searchRecipes({ search: debouncedSearch || undefined, page, pageSize: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => { showSuccess('recipes.deleted'); refetch(); },
    onError: (error) => showApiError(error, 'recipes.deleteError'),
  });

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
        case 'foodCount': cmp = a.foodCount - b.foodCount; break;
        case 'prepTime': cmp = (a.prepTimeMinutes ?? 0) - (b.prepTimeMinutes ?? 0); break;
      }
      return cmp * dir;
    });
    return recipes;
  }, [data?.recipes, sortKey, sortDir]);

  const handleDeleteClick = (e: React.MouseEvent, recipe: RecipeSummary) => {
    e.stopPropagation();
    setConfirmDelete({ recipeId: recipe.recipeId, name: recipe.name });
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
    { key: 'foodCount', label: t('recipes.foods') },
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

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between mt-3">
      <span className="text-xs text-text3">
        {t('common.page', { current: page, total: totalPages })} &middot; {t('common.total', { count: data!.totalCount })}
      </span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>&larr; {t('common.previous')}</Button>
        <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('common.next')} &rarr;</Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="📖"
        title={t('recipes.pageTitle')}
        subtitle={t('recipes.pageSubtitle')}
        actions={<Button variant="primary" onClick={() => setDialogRecipe('new')}>+ {t('recipes.addRecipe')}</Button>}
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
                  { key: 'name', label: t('recipes.recipeName'), render: (r: RecipeSummary) => r.name },
                  { key: 'foods', label: t('recipes.foods'), width: '80px', render: (r: RecipeSummary) => <span className="text-text2">{r.foodCount}</span> },
                  { key: 'prepTime', label: t('recipes.prepTime'), width: '80px', render: (r: RecipeSummary) => <span className="text-text3">{r.prepTimeMinutes ? `${r.prepTimeMinutes} min` : '—'}</span> },
                  { key: 'kcal', label: 'kcal', width: '80px', render: (r: RecipeSummary) => <span className="tabular-nums">{Math.round(r.totalNutrients.kcal)}</span> },
                  { key: 'protein', label: t('nutrition.proteinShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(r.totalNutrients.protein)}g</span> },
                  { key: 'carbs', label: t('nutrition.carbsShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(r.totalNutrients.carbs)}g</span> },
                  { key: 'fat', label: t('nutrition.fatShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(r.totalNutrients.fat)}g</span> },
                  { key: 'fiber', label: t('nutrition.fiberShort'), width: '70px', render: (r: RecipeSummary) => <span className="tabular-nums" style={{ color: 'var(--green)' }}>{Math.round(r.totalNutrients.fiber ?? 0)}g</span> },
                ]}
                rows={sortedRecipes}
                rowKey={(r) => r.recipeId}
                onRowClick={(r) => setDialogRecipe(r)}
                renderRowActions={(r: RecipeSummary) => deleteBtn(r)}
              />
              {pagination}
            </>
          ) : view === 'list' ? (
            <>
              <ListView
                items={sortedRecipes}
                itemKey={(r) => r.recipeId}
                renderAvatar={() => (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>📖</div>
                )}
                renderInfo={(r) => (
                  <div>
                    <div className="text-[13px] font-medium text-text truncate">{r.name}</div>
                    <div className="text-[11px] text-text3 flex items-center gap-2 mt-0.5">
                      <span>{r.foodCount} {t('recipes.foods').toLowerCase()}</span>
                      {r.prepTimeMinutes && <span>· {r.prepTimeMinutes} min</span>}
                      <span className="tabular-nums">· {Math.round(r.totalNutrients.kcal)} kcal</span>
                    </div>
                  </div>
                )}
                renderRight={(r) => <MacroBadges n={r.totalNutrients} />}
                onItemClick={(r) => setDialogRecipe(r)}
                renderActions={(r) => deleteBtn(r)}
              />
              {pagination}
            </>
          ) : (
            <CardGrid>
              {sortedRecipes.map((r) => (
                <Card key={r.recipeId} onClick={() => setDialogRecipe(r)}>
                  <CardCover><div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">📖</div></CardCover>
                  <CardBody>
                    <div className="text-[13px] font-medium text-text mb-1.5 truncate">{r.name}</div>
                    <CardPropRow label="kcal">{Math.round(r.totalNutrients.kcal)}</CardPropRow>
                    <CardPropRow label={`${t('nutrition.proteinShort')} / ${t('nutrition.carbsShort')} / ${t('nutrition.fatShort')} / ${t('nutrition.fiberShort')}`}><MacroBadges n={r.totalNutrients} /></CardPropRow>
                    <CardPropRow label={t('recipes.foods')}>{r.foodCount}</CardPropRow>
                    {r.prepTimeMinutes && <CardPropRow label={t('recipes.prepTime')}>{r.prepTimeMinutes} min</CardPropRow>}
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
          )}
        </div>
      </div>

      {/* Recipe dialog (view + edit in one) */}
      <RecipeDialog
        open={dialogRecipe !== null}
        recipe={dialogRecipe === 'new' ? null : dialogRecipe}
        onClose={() => setDialogRecipe(null)}
        onSaved={() => refetch()}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('recipes.deleteConfirmTitle')}
        footer={<>
          <Button onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { if (confirmDelete) { deleteMutation.mutate(confirmDelete.recipeId); setConfirmDelete(null); } }}>{t('recipes.deleteRecipe')}</Button>
        </>}
        maxWidth={400}
      >
        <p className="text-[13px] text-text2">{t('recipes.deleteConfirmMessage', { name: confirmDelete?.name })}</p>
      </Dialog>
    </div>
  );
}
