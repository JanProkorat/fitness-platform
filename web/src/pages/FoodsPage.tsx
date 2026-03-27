import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { searchFoods, deleteFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { FoodSummary } from '@/api/food-types';
import AddFoodDialog from '@/components/nutrition/AddFoodDialog';
import EditFoodDrawer from '@/components/nutrition/EditFoodDrawer';
import { PageHeader, Toolbar } from '@/components/layout';
import { Button, Dialog, SearchInput } from '@/components/ui';
import { DatabaseTable, CardGrid, Card, CardCover, CardBody, CardPropRow } from '@/components/data';

type DrawerMode = { type: 'add' } | { type: 'edit'; food: FoodSummary } | null;


export default function FoodsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isNutritionist = user?.roles.includes('Nutritionist');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods', debouncedSearch, page],
    queryFn: () =>
      searchFoods({
        q: debouncedSearch || undefined,
        page,
        pageSize: 20,
      }),
  });

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
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        icon="📦"
        title="Databaze potravin"
      />
      <Toolbar
        views={[
          { id: 'table', label: 'Tabulka', icon: '☰' },
          { id: 'cards', label: 'Karty', icon: '▦' },
        ]}
        activeView={view}
        onViewChange={(v) => setView(v as 'table' | 'cards')}
      >
        <SearchInput
          placeholder="Hledat potraviny..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[240px]"
        />
        {isNutritionist && (
          <Button variant="primary" onClick={() => openDrawer({ type: 'add' })}>
            + Nova potravina
          </Button>
        )}
      </Toolbar>

      <div className="px-20 py-3 max-w-[1200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-text3">
            {t('common.loading')}
          </div>
        ) : !data?.foods?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-text3">
            <span className="text-4xl">🍞</span>
            <p className="mt-3 text-sm">{t('foods.noFoods')}</p>
            <p className="mt-1 text-xs text-text3">{t('foods.noFoodsHint')}</p>
          </div>
        ) : view === 'table' ? (
          <>
            <DatabaseTable
              columns={[
                { key: 'name', label: 'Nazev', render: (food: FoodSummary) => food.name },
                { key: 'note', label: 'Poznámka', render: (food: FoodSummary) => <span className="text-text3">{food.note || '—'}</span> },
                { key: 'kcal', label: 'kcal/100g', width: '90px', render: (food: FoodSummary) => <span className="tabular-nums">{food.nutrientValue.kcal}</span> },
                { key: 'protein', label: 'B', width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--blue)' }}>{food.nutrientValue.protein}g</span> },
                { key: 'carbs', label: 'S', width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--orange)' }}>{food.nutrientValue.carbs}g</span> },
                { key: 'fat', label: 'T', width: '70px', render: (food: FoodSummary) => <span className="tabular-nums" style={{ color: 'var(--purple)' }}>{food.nutrientValue.fat}g</span> },
              ]}
              rows={data.foods}
              rowKey={(food) => food.foodId}
              onRowClick={isNutritionist ? (food) => openDrawer({ type: 'edit', food }) : undefined}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text3">
                  {t('common.page', { current: page, total: totalPages })} &middot;{' '}
                  {t('common.total', { count: data.totalCount })}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    &larr; {t('common.previous')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('common.next')} &rarr;
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Cards view */
          <CardGrid>
            {data.foods.map((food) => (
              <Card
                key={food.foodId}
                onClick={isNutritionist ? () => openDrawer({ type: 'edit', food }) : undefined}
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
                  <CardPropRow label="B / S / T">
                    <span style={{ color: 'var(--blue)' }}>{food.nutrientValue.protein}g</span>
                    {' / '}
                    <span style={{ color: 'var(--orange)' }}>{food.nutrientValue.carbs}g</span>
                    {' / '}
                    <span style={{ color: 'var(--purple)' }}>{food.nutrientValue.fat}g</span>
                  </CardPropRow>
                </CardBody>
              </Card>
            ))}
          </CardGrid>
        )}
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
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('foods.deleteConfirmTitle')}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              {t('foods.delete')}
            </Button>
          </>
        }
        maxWidth={400}
      >
        <p className="text-[13px] text-text2">
          {t('foods.deleteConfirmMessage', { name: confirmDelete?.name })}
        </p>
      </Dialog>
    </div>
  );
}
