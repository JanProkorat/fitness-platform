import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { searchFoods, deleteFood } from '@/api/foods';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import type { FoodSummary, FoodCategory } from '@/api/food-types';
import { FoodDialog } from '@/components/nutrition/FoodDialog';
import { PageHeader, Toolbar } from '@/components/layout';
import { Button, SearchInput } from '@/components/ui';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { DatabaseTable, ListView, CardGrid, Card, CardCover, CardBody, CardPropRow, MacroBadges, Pagination } from '@/components/data';
import { CATEGORY_CSS_COLORS, ALL_CATEGORIES } from '@/components/nutrition/food-category';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDialogState } from '@/hooks/useDialogState';

type ViewType = 'table' | 'list' | 'cards';
type SortKey = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'category';
type SortDir = 'asc' | 'desc';

function CategoryTag({ category, t }: { category: string; t: (key: string) => string }) {
  const cat = category || 'Other';
  const colors = CATEGORY_CSS_COLORS[cat] ?? CATEGORY_CSS_COLORS.Other;
  return (
    <span
      className="text-[10px] font-medium rounded-sm px-1.5 py-[1px]"
      style={{ background: colors.bg, color: colors.color }}
    >
      {t(`foods.category${cat}`)}
    </span>
  );
}


export default function FoodsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isNutritionist = user?.roles.includes('Nutritionist');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewType>('table');
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const foodDialog = useDialogState<FoodSummary>();

  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods', debouncedSearch, categoryFilter, page],
    queryFn: () =>
      searchFoods({
        q: debouncedSearch || undefined,
        category: categoryFilter || undefined,
        page,
        pageSize: 50,
      }),
  });

  const deleteMutation = useApiMutation(deleteFood, {
    successKey: 'foods.deleted',
    errorKey: 'foods.deleteError',
    onSuccess: () => refetch(),
  });

  const confirmDelete = useConfirmDelete(deleteMutation);

  const handleDeleteClick = (e: React.MouseEvent, food: FoodSummary) => {
    e.stopPropagation();
    confirmDelete.requestDelete(food.foodId, food.name);
  };

  // Client-side sort
  const sortedFoods = useMemo(() => {
    const foods = [...(data?.foods ?? [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    foods.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'kcal': cmp = a.nutrientValue.kcal - b.nutrientValue.kcal; break;
        case 'protein': cmp = a.nutrientValue.protein - b.nutrientValue.protein; break;
        case 'carbs': cmp = a.nutrientValue.carbs - b.nutrientValue.carbs; break;
        case 'fat': cmp = a.nutrientValue.fat - b.nutrientValue.fat; break;
        case 'fiber': cmp = (a.nutrientValue.fiber ?? 0) - (b.nutrientValue.fiber ?? 0); break;
        case 'category': cmp = (a.category ?? '').localeCompare(b.category ?? ''); break;
      }
      return cmp * dir;
    });
    return foods;
  }, [data?.foods, sortKey, sortDir]);

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  const views = [
    { id: 'table', label: t('foods.viewTable'), icon: '⊞' },
    { id: 'list', label: t('foods.viewList'), icon: '☰' },
    { id: 'cards', label: t('foods.viewCards'), icon: '⬜' },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'name', label: t('foods.foodName') },
    { key: 'kcal', label: 'kcal' },
    { key: 'protein', label: t('foods.protein') },
    { key: 'carbs', label: t('foods.carbs') },
    { key: 'fat', label: t('foods.fat') },
    { key: 'fiber', label: t('foods.fiber') },
    { key: 'category', label: t('foods.category') },
  ];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setShowSortMenu(false);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="📦"
        title={t('foods.pageTitle')}
        subtitle={t('foods.pageSubtitle')}
        actions={isNutritionist ? (
          <Button variant="primary" onClick={() => foodDialog.openNew()}>
            + {t('foods.addFood')}
          </Button>
        ) : undefined}
      />
      <Toolbar
        views={views}
        activeView={view}
        onViewChange={(v) => setView(v as ViewType)}
      >
        <SearchInput
          placeholder={t('foods.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[240px]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value as FoodCategory | ''); setPage(1); }}
          className="rounded-md border border-border-md bg-bg px-3 py-[6px] text-[13px] text-text outline-none transition-colors focus:border-border-hv"
        >
          <option value="">{t('foods.categoryAll')}</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{t(`foods.category${cat}`)}</option>
          ))}
        </select>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setShowSortMenu((v) => !v)}>
            ↕ {t('foods.sort')}
          </Button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-bg2 border border-border rounded-md shadow-lg py-1 min-w-[160px]">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSort(opt.key)}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-hover transition-colors flex items-center justify-between"
                    style={{ color: sortKey === opt.key ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {opt.label}
                    {sortKey === opt.key && (
                      <span className="text-[10px] ml-2">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
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
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !sortedFoods.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">🍞</span>
              <p className="mt-3 text-sm">{t('foods.noFoods')}</p>
              <p className="mt-1 text-xs text-text3">{t('foods.noFoodsHint')}</p>
            </div>
          ) : view === 'table' ? (
            <>
              <DatabaseTable
                columns={[
                  { key: 'name', label: t('foods.foodName'), render: (food: FoodSummary) => food.name },
                  { key: 'note', label: t('foods.note'), render: (food: FoodSummary) => <span className="text-text3 text-[12px] italic truncate">{food.note || '—'}</span> },
                  { key: 'kcal', label: 'kcal/100g', width: '90px', render: (food: FoodSummary) => <span className="tabular-nums">{food.nutrientValue.kcal}</span> },
                  { key: 'protein', label: t('nutrition.proteinShort'), width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--blue)' }}>{food.nutrientValue.protein}g</span> },
                  { key: 'carbs', label: t('nutrition.carbsShort'), width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--orange)' }}>{food.nutrientValue.carbs}g</span> },
                  { key: 'fat', label: t('nutrition.fatShort'), width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--purple)' }}>{food.nutrientValue.fat}g</span> },
                  { key: 'fiber', label: t('nutrition.fiberShort'), width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--green)' }}>{food.nutrientValue.fiber ?? 0}g</span> },
                  { key: 'category', label: t('foods.category'), width: '140px', render: (food: FoodSummary) => (
                    <CategoryTag category={food.category ?? 'Other'} t={t} />
                  )},
                ]}
                rows={sortedFoods}
                rowKey={(food) => food.foodId}
                onRowClick={isNutritionist ? (food) => foodDialog.openEdit(food) : undefined}
                renderRowActions={isNutritionist ? (food: FoodSummary) => (
                  <button
                    onClick={(e) => handleDeleteClick(e, food)}
                    disabled={deleteMutation.isPending}
                    title={t('foods.delete')}
                    className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : undefined}
              />

              <Pagination page={page} totalPages={totalPages} totalCount={data?.totalCount ?? 0} onPageChange={setPage} className="mt-3" />
            </>
          ) : view === 'list' ? (
            <>
              <ListView
                items={sortedFoods}
                itemKey={(food) => food.foodId}
                renderAvatar={(food) => {
                  const cat = food.category ?? 'Other';
                  const colors = CATEGORY_CSS_COLORS[cat] ?? CATEGORY_CSS_COLORS.Other;
                  return (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={{ background: colors.bg, color: colors.color }}>
                      {food.name.charAt(0).toUpperCase()}
                    </div>
                  );
                }}
                renderInfo={(food) => (
                  <div>
                    <div className="text-[13px] font-medium text-text truncate">{food.name}</div>
                    <div className="text-[11px] text-text3 flex items-center gap-2 mt-0.5">
                      <CategoryTag category={food.category ?? 'Other'} t={t} />
                      <span className="tabular-nums">{food.nutrientValue.kcal} kcal</span>
                    </div>
                  </div>
                )}
                renderRight={(food) => <MacroBadges nutrients={food.nutrientValue} />}
                onItemClick={isNutritionist ? (food) => foodDialog.openEdit(food) : undefined}
                renderActions={isNutritionist ? (food) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, food); }}
                    className="rounded-sm p-1 text-text3 transition-colors hover:text-red"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : undefined}
              />

              <Pagination page={page} totalPages={totalPages} totalCount={data?.totalCount ?? 0} onPageChange={setPage} className="mt-3" />
            </>
          ) : (
            /* Cards view */
            <CardGrid>
              {sortedFoods.map((food) => (
                <Card
                  key={food.foodId}
                  onClick={isNutritionist ? () => foodDialog.openEdit(food) : undefined}
                >
                  <CardCover>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">
                      📦
                    </div>
                  </CardCover>
                  <CardBody>
                    <div className="text-[13px] font-medium text-text mb-1.5 truncate">
                      {food.name}
                    </div>
                    <CardPropRow label="kcal">
                      {food.nutrientValue.kcal}
                    </CardPropRow>
                    <CardPropRow label={`${t('nutrition.proteinShort')} / ${t('nutrition.carbsShort')} / ${t('nutrition.fatShort')} / ${t('nutrition.fiberShort')}`}>
                      <MacroBadges nutrients={food.nutrientValue} />
                    </CardPropRow>
                    <CardPropRow label={t('foods.category')}>
                      <CategoryTag category={food.category ?? 'Other'} t={t} />
                    </CardPropRow>
                  </CardBody>
                </Card>
              ))}
            </CardGrid>
          )}
        </div>
      </div>

      {/* Food dialog (view + edit) */}
      <FoodDialog
        open={foodDialog.isOpen}
        food={foodDialog.item}
        onClose={foodDialog.close}
        onSaved={(updated) => {
          // Keep the dialog's snapshot in sync with what the server just
          // returned so reopening edit mode shows the latest values.
          // `openEdit` just replaces the stored item — the dialog stays
          // open and its internal mode state is unaffected because the
          // foodId (the effect's dep) doesn't change.
          foodDialog.openEdit(updated);
          refetch();
        }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete.target}
        name={confirmDelete.target?.name ?? ''}
        isPending={confirmDelete.isPending}
        onConfirm={confirmDelete.confirmDelete}
        onCancel={confirmDelete.cancelDelete}
        title={t('foods.deleteConfirmTitle')}
        message={confirmDelete.target ? t('foods.deleteConfirmMessage', { name: confirmDelete.target.name }) : undefined}
      />
    </div>
  );
}
