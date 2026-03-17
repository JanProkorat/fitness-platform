import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { searchFoods } from '@/api/foods';
import AddFoodDialog from '@/components/nutrition/AddFoodDialog';
import NutritionBadge from '@/components/nutrition/NutritionBadge';

export default function FoodsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isNutritionist = user?.roles.includes('Nutritionist');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState<string>('');
  const [showAddFood, setShowAddFood] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods', debouncedSearch, source, page],
    queryFn: () =>
      searchFoods({
        q: debouncedSearch || undefined,
        source: source || undefined,
        page,
        pageSize: 20,
      }),
  });

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
            onClick={() => setShowAddFood(!showAddFood)}
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
          >
            {t('foods.addFood')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Add food dialog */}
        {showAddFood && <AddFoodDialog onCreated={() => refetch()} />}

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
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_90px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('foods.foodName')}</span>
                <span className="lbl">{t('foods.kcal')}</span>
                <span className="lbl">{t('foods.protein')}</span>
                <span className="lbl">{t('foods.carbs')}</span>
                <span className="lbl">{t('foods.fat')}</span>
                <span className="lbl">{t('foods.source')}</span>
                <span className="lbl text-right">{t('foods.verified')}</span>
              </div>

              {/* Rows */}
              {data.foods.map((food) => (
                <div
                  key={food.foodId}
                  className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_90px] items-center gap-4 border-b border-charcoal px-5 py-3 last:border-0"
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
                  <div className="text-right">
                    {food.isVerified ? (
                      <span className="inline-flex items-center rounded-sm bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400">
                        {t('foods.verified')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-sm bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-text3">
                        {t('foods.unverified')}
                      </span>
                    )}
                  </div>
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
    </div>
  );
}
