import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { searchFoods, deleteFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { FoodSummary } from '@/api/food-types';
import AddFoodDialog from '@/components/nutrition/AddFoodDialog';
import EditFoodDrawer from '@/components/nutrition/EditFoodDrawer';
import NutritionBadge from '@/components/nutrition/NutritionBadge';

type DrawerMode = { type: 'add' } | { type: 'edit'; food: FoodSummary } | null;

export default function FoodsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isNutritionist = user?.roles.includes('Nutritionist');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState<string>('');

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const openDrawer = useCallback((mode: NonNullable<DrawerMode>) => {
    setDrawerMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerMode(null), 300);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fast query: local results only (skips external API call)
  const { data: localData, isLoading: localLoading, refetch: refetchLocal } = useQuery({
    queryKey: ['foods-local', debouncedSearch, source, page],
    queryFn: () =>
      searchFoods({
        q: debouncedSearch || undefined,
        source: source || undefined,
        page,
        pageSize: 20,
        excludeExternal: true,
      }),
  });

  // Slow query: includes external API results (only when no source filter and on page 1)
  const shouldFetchExternal = !source && page === 1 && !!debouncedSearch;
  const { data: externalData, isFetching: externalFetching, refetch: refetchExternal } = useQuery({
    queryKey: ['foods-external', debouncedSearch],
    queryFn: () =>
      searchFoods({
        q: debouncedSearch || undefined,
        page: 1,
        pageSize: 20,
      }),
    enabled: shouldFetchExternal,
  });

  // Merge: show local results immediately, append unique external results when available
  const data = (() => {
    if (!localData) return undefined;
    if (!shouldFetchExternal || !externalData) return localData;

    const localIds = new Set(localData.foods.map((f) => f.foodId));
    const uniqueExternal = externalData.foods.filter((f) => !localIds.has(f.foodId));
    return {
      ...localData,
      foods: [...localData.foods, ...uniqueExternal],
    };
  })();

  const isLoading = localLoading;
  const refetch = () => { refetchLocal(); if (shouldFetchExternal) refetchExternal(); };

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: () => {
      showSuccess('foods.deleted');
      refetch();
    },
    onError: (error) => showApiError(error, 'foods.deleteError'),
  });

  const [confirmDelete, setConfirmDelete] = useState<{ foodId: string; name: string } | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, food: FoodSummary) => {
    e.stopPropagation();
    setConfirmDelete({ foodId: food.foodId, name: food.name });
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.foodId);
      setConfirmDelete(null);
    }
  };

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('foods.title')}</h1>
          <p className="text-xs text-muted">{t('foods.subtitle')}</p>
        </div>
        {isNutritionist && (
          <button
            onClick={() => openDrawer({ type: 'add' })}
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
          >
            {t('foods.addFood')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search / filter bar */}
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('foods.search')}
              className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 pl-10 text-sm text-text outline-none transition-colors focus:border-gold/40"
            />
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
          >
            <option value="">{t('foods.sourceAll')}</option>
            <option value="System">{t('foods.sourceSystem')}</option>
            <option value="Custom">{t('foods.sourceCustom')}</option>
            <option value="OpenFoodFacts">{t('foods.sourceOpenFoodFacts')}</option>
          </select>
        </div>

        {shouldFetchExternal && externalFetching && (
          <div className="mb-2 text-xs text-text3">
            {t('foods.loadingExternal')}
          </div>
        )}

        {/* Food table */}
        <div className="rounded-sm border border-border bg-surface">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.foods?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F956;</span>
              <p className="mt-3 text-sm">{t('foods.noFoods')}</p>
              <p className="mt-1 text-xs text-muted">{t('foods.noFoodsHint')}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_60px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('foods.foodName')}</span>
                <span className="lbl">{t('foods.kcal')}</span>
                <span className="lbl">{t('foods.protein')}</span>
                <span className="lbl">{t('foods.carbs')}</span>
                <span className="lbl">{t('foods.fat')}</span>
                <span className="lbl">{t('foods.source')}</span>
                {isNutritionist && <span className="lbl" />}
              </div>

              {/* Rows */}
              {data.foods.map((food) => (
                <div
                  key={food.foodId}
                  onClick={() => isNutritionist && openDrawer({ type: 'edit', food })}
                  className={`grid grid-cols-[1fr_80px_80px_80px_80px_100px_60px] items-center gap-4 border-b border-charcoal px-5 py-3 last:border-0 ${isNutritionist ? 'cursor-pointer transition-colors hover:bg-white/[0.02]' : ''}`}
                >
                  <span className="truncate text-sm font-semibold">{food.name}</span>
                  <span className="text-sm text-text2">
                    <NutritionBadge
                      label=""
                      value={food.nutrientValue.kcal}
                      color="kcal"
                    />
                  </span>
                  <span className="text-sm text-text2">
                    {food.nutrientValue.protein}g
                  </span>
                  <span className="text-sm text-text2">
                    {food.nutrientValue.carbs}g
                  </span>
                  <span className="text-sm text-text2">
                    {food.nutrientValue.fat}g
                  </span>
                  <span className="text-xs capitalize text-text3">
                    {food.source ?? '-'}
                  </span>
                  {isNutritionist && (
                    <div className="text-center">
                      <button
                        onClick={(e) => handleDeleteClick(e, food)}
                        disabled={food.source === 'openfoodfacts' || deleteMutation.isPending}
                        title={food.source === 'openfoodfacts' ? t('foods.cannotDeleteExternal') : t('foods.delete')}
                        className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-muted">
                    {t('common.page', { current: page, total: totalPages })} &middot;{' '}
                    {t('common.total', { count: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      &larr; {t('common.previous')}
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      {t('common.next')} &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right-side drawer */}
      {drawerMode && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              {drawerMode.type === 'add' ? (
                <AddFoodDialog
                  onCreated={() => {
                    refetch();
                    closeDrawer();
                  }}
                  onClose={closeDrawer}
                />
              ) : (
                <EditFoodDrawer
                  food={drawerMode.food}
                  onSaved={() => {
                    refetch();
                    closeDrawer();
                  }}
                  onClose={closeDrawer}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-sm border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-sm font-bold">{t('foods.deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-text2">
              {t('foods.deleteConfirmMessage', { name: confirmDelete.name })}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold text-text3 transition-colors hover:text-text"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-sm bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
              >
                {t('foods.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
