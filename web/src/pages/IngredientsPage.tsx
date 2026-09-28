import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { useIngredientListParams } from '@/hooks/useIngredientListParams';
import { useIngredients } from '@/hooks/useIngredientsQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { FoodSummary } from '@/api/food-types';
import IngredientCategoryFilterPopover from '@/components/ingredients/IngredientCategoryFilterPopover';
import IngredientTagFilterPopover from '@/components/ingredients/IngredientTagFilterPopover';
import IngredientsTable from '@/components/ingredients/IngredientsTable';
import IngredientsPagination from '@/components/ingredients/IngredientsPagination';
import IngredientDrawer from '@/components/ingredients/IngredientDrawer';

/**
 * The trainer-portal Ingredients page — search, Category/Tags filter pills,
 * the ingredients (Foods) table, pagination, and the create/edit/view drawer.
 * See `docs/design/ingredients/inventory.md` for the design spec and
 * `state/handoff-design-1115.json` for the approved scope. Mirrors
 * `ClientsPage` (`@/pages/ClientsPage.tsx`) for composition and state split.
 */
export default function IngredientsPage() {
  const { t } = useTranslation();
  const { filters, setSearch, setCategory, setTags, setPage, clearFilters } = useIngredientListParams();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isNutritionist = roles.includes('Nutritionist');

  const [searchInput, setSearchInput] = useState(filters.search);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSummary | null>(null);

  // Re-sync the local input when the URL's search value changes from
  // elsewhere (browser back/forward, clearFilters, a hand-edited URL).
  // Adjusted during render — see ClientsPage's `syncedSearch` for the same
  // "adjust state during render" pattern and why it beats a useEffect here.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  useDebouncedValue(searchInput, 300, () => {
    if (searchInput !== filters.search) {
      setSearch(searchInput);
    }
  });

  const ingredientsQuery = useIngredients(filters);
  const hasActiveFilter = filters.search !== '' || filters.category !== undefined || filters.tags.length > 0;

  function openCreateDrawer() {
    setSelectedFood(null);
    setDrawerOpen(true);
  }

  function openRowDrawer(food: FoodSummary) {
    setSelectedFood(food);
    setDrawerOpen(true);
  }

  // Creating (selectedFood === null) is always editable for a nutritionist —
  // the "not owned" half only applies to an EXISTING food (a system row, or
  // another coach's shared row). The previous `!selectedFood?.isOwnedByCurrentUser`
  // evaluated to `!undefined` === true while creating, so "+ New Ingredient"
  // opened a drawer with every input disabled.
  const drawerReadOnly = !isNutritionist || (selectedFood !== null && !selectedFood.isOwnedByCurrentUser);

  return (
    // `h-full` fills AppShell's `<main>` (a definite-height flex-1 region,
    // see AppShell.tsx) so the table card below can claim the remaining
    // space and scroll internally instead of the whole page scrolling —
    // docs/design/ingredients/inventory.md point 5, main's own overflow-y-auto
    // stays as a graceful fallback if this content is ever taller than that.
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-title font-bold text-ink">{t('ingredients.title')}</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-search">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('ingredients.searchPlaceholder')}
            className="h-8 pl-8"
            aria-label={t('ingredients.searchPlaceholder')}
          />
        </div>
        {isNutritionist && (
          <Button type="button" size="lg" onClick={openCreateDrawer}>
            {t('ingredients.newIngredient')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <IngredientCategoryFilterPopover selectedCategory={filters.category} onChange={setCategory} />
        <IngredientTagFilterPopover selectedTags={filters.tags} onChange={setTags} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex-1 overflow-y-auto">
          <IngredientsTable
            foods={ingredientsQuery.data?.foods ?? []}
            isPending={ingredientsQuery.isPending}
            isError={ingredientsQuery.isError}
            onRetry={() => void ingredientsQuery.refetch()}
            hasActiveFilter={hasActiveFilter}
            onClearFilters={clearFilters}
            onRowClick={openRowDrawer}
          />
        </div>
        <IngredientsPagination
          rowCount={(ingredientsQuery.data?.foods ?? []).length}
          page={filters.page}
          pageSize={filters.pageSize}
          totalCount={ingredientsQuery.data?.totalCount ?? 0}
          onPageChange={setPage}
        />
      </div>

      <IngredientDrawer open={drawerOpen} onOpenChange={setDrawerOpen} food={selectedFood} readOnly={drawerReadOnly} />
    </div>
  );
}
