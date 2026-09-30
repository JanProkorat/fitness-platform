import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FoodSummary } from '@/api/food-types';
import LibraryBadge from '@/components/ingredients/LibraryBadge';
import TagPill from '@/components/tags/TagPill';

const SKELETON_ROW_COUNT = 5;

interface Props {
  foods: FoodSummary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onRowClick: (food: FoodSummary) => void;
  /** Gates the Tags column (#1120) — food tags are nutritionist-owned, so a
   * trainer-only coach gets no tag chips at all, not even an empty column. */
  isNutritionist: boolean;
}

/** The Ingredients table. Mirrors `ClientsTable` (`@/components/clients/ClientsTable.tsx`). */
export default function IngredientsTable({
  foods,
  isPending,
  isError,
  onRetry,
  hasActiveFilter,
  onClearFilters,
  onRowClick,
  isNutritionist,
}: Props) {
  const { t } = useTranslation();
  const columnCount = isNutritionist ? 6 : 5;

  return (
    <Table>
      {/* `sticky top-0` pins the header to the page's own vertical scroller
          (see IngredientsPage.tsx's `overflow-visible` override on
          `ui/table.tsx`'s horizontal-scroll wrapper). `bg-muted` is already
          opaque, so scrolled rows don't show through underneath. */}
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          {/* Name has no fixed width — it takes all remaining space. The
              other four columns are fixed (docs/design/ingredients/inventory.md
              point 3: 120/180/180/100) via Tailwind's spacing scale, which
              is itself token-driven off the single `--spacing` base — not a
              one-off literal. */}
          <TableHead className="px-5 py-3">{t('ingredients.table.columnName')}</TableHead>
          <TableHead className="w-30 px-5 py-3">{t('ingredients.table.columnCalories')}</TableHead>
          <TableHead className="w-45 px-5 py-3">{t('ingredients.table.columnNutrients')}</TableHead>
          <TableHead className="w-45 px-5 py-3">{t('ingredients.table.columnCategory')}</TableHead>
          {isNutritionist && (
            <TableHead className="w-45 px-5 py-3">{t('ingredients.table.columnTags')}</TableHead>
          )}
          <TableHead className="w-25 px-5 py-3">{t('ingredients.table.columnLibrary')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending &&
          Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={columnCount}>
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          ))}

        {!isPending && isError && (
          <TableRow>
            <TableCell colSpan={columnCount} className="py-10 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  {t('ingredients.retry')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isPending && !isError && foods.length === 0 && (
          <TableRow>
            <TableCell colSpan={columnCount} className="py-10 text-center">
              <div className="flex flex-col items-center gap-2">
                <p className="text-body text-muted-foreground">{t('ingredients.noResultsForFilters')}</p>
                {hasActiveFilter && (
                  <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                    {t('ingredients.clearFilters')}
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isPending &&
          !isError &&
          foods.map((food) => (
            <TableRow
              key={food.foodId}
              className="cursor-pointer"
              onClick={() => onRowClick(food)}
            >
              {/* Name: SemiBold 14 dark. `text-copy` is the existing 14px
                  token (audience-panel body copy) reused here for its size,
                  not its original semantic name — no second 14px token. */}
              <TableCell className="px-5 py-3 text-copy font-semibold text-foreground">{food.name}</TableCell>
              <TableCell className="w-30 px-5 py-3 text-body font-medium text-muted-foreground">
                {t('ingredients.table.caloriesValue', { count: food.nutrientValue?.kcal ?? 0 })}
              </TableCell>
              <TableCell className="w-45 px-5 py-3 text-meta text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{t('ingredients.table.proteinValue', { count: food.nutrientValue?.protein ?? 0 })}</span>
                  <span>{t('ingredients.table.carbsValue', { count: food.nutrientValue?.carbs ?? 0 })}</span>
                  <span>{t('ingredients.table.fatValue', { count: food.nutrientValue?.fat ?? 0 })}</span>
                </div>
              </TableCell>
              <TableCell className="w-45 px-5 py-3 text-body text-muted-foreground">
                {food.category && t(`ingredients.category.${food.category}`)}
              </TableCell>
              {isNutritionist && (
                <TableCell className="w-45 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {(food.tags ?? []).map((tag) => (
                      <TagPill key={tag.tagId} name={tag.name ?? ''} colorHex={tag.colorHex} />
                    ))}
                  </div>
                </TableCell>
              )}
              <TableCell className="w-25 px-5 py-3">
                <LibraryBadge isOwnedByCurrentUser={food.isOwnedByCurrentUser} isSystem={food.isSystem} />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
