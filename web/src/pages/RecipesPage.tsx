import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { getErrorStatus } from '@/lib/api-errors';
import { useRecipeListParams } from '@/hooks/useRecipeListParams';
import { useRecipes } from '@/hooks/useRecipesQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DietaryPreference, RecipeMealType, type RecipeSummaryDto } from '@/api/recipe-types';
import OptionFilterPopover from '@/components/library/OptionFilterPopover';
import OwnerFilterPopover from '@/components/library/OwnerFilterPopover';
import LibraryTagFilterPopover from '@/components/library/LibraryTagFilterPopover';
import Pagination from '@/components/library/Pagination';
import RecipesTable from '@/components/recipes/RecipesTable';
import RecipeDrawer from '@/components/recipes/RecipeDrawer';

const MEAL_TYPE_VALUES = Object.values(RecipeMealType);
const DIETARY_PREFERENCE_VALUES = Object.values(DietaryPreference);

/**
 * The trainer-portal Recipes page — search, Meal type / Dietary preference /
 * Owner / Tags filter pills, the recipes table, pagination, and the create/edit/view
 * drawer. Mirrors `IngredientsPage`. Every /recipes endpoint is
 * nutritionist-only, so a trainer-only coach sees an explanatory state
 * instead of a failed load.
 */
export default function RecipesPage() {
  const { t } = useTranslation();
  const {
    filters,
    setSearch,
    setMealTypes,
    setDietaryPreferences,
    setOwners,
    setTags,
    cycleSort,
    setPage,
    clearFilters,
  } = useRecipeListParams();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isNutritionist = roles.includes('Nutritionist');

  const [searchInput, setSearchInput] = useState(filters.search);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSummaryDto | null>(null);

  // Re-sync the local input when the URL's search value changes from
  // elsewhere (back/forward, clearFilters) — "adjust state during render",
  // same pattern as IngredientsPage.
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

  const recipesQuery = useRecipes(filters, isNutritionist);
  const isForbidden = !isNutritionist || (recipesQuery.isError && getErrorStatus(recipesQuery.error) === 403);

  const recipes = recipesQuery.data?.recipes ?? [];
  const totalCount = recipesQuery.data?.totalCount ?? 0;
  const hasActiveFilter =
    filters.search !== '' ||
    filters.mealTypes.length > 0 ||
    filters.dietaryPreferences.length > 0 ||
    filters.owners.length > 0 ||
    filters.tags.length > 0;
  const showEmptyState = !recipesQuery.isPending && !recipesQuery.isError && totalCount === 0 && !hasActiveFilter;

  function openCreateDrawer() {
    setSelectedRecipe(null);
    setDrawerOpen(true);
  }

  function openRowDrawer(recipe: RecipeSummaryDto) {
    setSelectedRecipe(recipe);
    setDrawerOpen(true);
  }

  // Creating (selectedRecipe === null) is always editable; the "not owned"
  // half only applies to an EXISTING recipe (system row, or a shared one).
  const drawerReadOnly = selectedRecipe !== null && !selectedRecipe.isOwnedByCurrentUser;

  if (isForbidden) {
    return (
      <div className="flex h-full flex-col gap-4">
        <h1 className="text-title font-bold text-ink">{t('recipes.title')}</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Lock className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-copy font-bold text-ink">{t('recipes.nutritionistsOnly.title')}</p>
          <p className="max-w-search text-body text-muted-foreground">{t('recipes.nutritionistsOnly.body')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-title font-bold text-ink">{t('recipes.title')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-search">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('recipes.searchPlaceholder')}
            className="h-8 pl-8"
            aria-label={t('recipes.searchPlaceholder')}
          />
        </div>
        <OptionFilterPopover
          label={t('recipes.filters.mealType')}
          options={MEAL_TYPE_VALUES.map((value) => ({ value, label: t(`recipes.mealType.${value}`) }))}
          selected={filters.mealTypes}
          onChange={setMealTypes}
        />
        <OptionFilterPopover
          label={t('recipes.filters.dietaryPreference')}
          options={DIETARY_PREFERENCE_VALUES.map((value) => ({
            value,
            label: t(`ingredients.dietaryPreference.${value}`),
          }))}
          selected={filters.dietaryPreferences}
          onChange={setDietaryPreferences}
        />
        <OwnerFilterPopover selectedOwners={filters.owners} onChange={setOwners} />
        <LibraryTagFilterPopover selectedTagIds={filters.tags} onChange={setTags} />
        <Button type="button" size="lg" className="ml-auto" onClick={openCreateDrawer}>
          {t('recipes.newRecipe')}
        </Button>
      </div>

      {showEmptyState ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-card">
            <Plus className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-copy font-bold text-ink">{t('recipes.empty.title')}</p>
            <p className="text-body text-muted-foreground">{t('recipes.empty.hint')}</p>
          </div>
          <Button type="button" onClick={openCreateDrawer}>
            <Plus className="size-4" aria-hidden="true" />
            {t('recipes.empty.create')}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex-1 overflow-y-auto [&_[data-slot=table-container]]:overflow-visible">
            <RecipesTable
              recipes={recipes}
              isPending={recipesQuery.isPending}
              isError={recipesQuery.isError}
              onRetry={() => void recipesQuery.refetch()}
              hasActiveFilter={hasActiveFilter}
              onClearFilters={clearFilters}
              onRowClick={openRowDrawer}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSortChange={cycleSort}
            />
          </div>
          <Pagination
            rowCount={recipes.length}
            page={filters.page}
            pageSize={filters.pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      )}

      <RecipeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} recipe={selectedRecipe} readOnly={drawerReadOnly} />
    </div>
  );
}
