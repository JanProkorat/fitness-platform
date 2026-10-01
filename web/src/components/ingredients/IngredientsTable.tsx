import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FoodSummary } from '@/api/food-types';
import { FoodSortDirection, FoodSortField } from '@/api/food-types';
import LibraryBadge from '@/components/ingredients/LibraryBadge';
import IngredientThumbnail from '@/components/ingredients/IngredientThumbnail';
import TagPill from '@/components/tags/TagPill';

const SKELETON_ROW_COUNT = 5;

function sortAriaValue(sortBy: FoodSortField | null, sortDir: FoodSortDirection, field: FoodSortField) {
  if (sortBy !== field) {
    return 'none' as const;
  }
  return sortDir === FoodSortDirection.Descending ? ('descending' as const) : ('ascending' as const);
}

interface SortIconProps {
  active: boolean;
  sortDir: FoodSortDirection;
}

function SortIcon({ active, sortDir }: SortIconProps) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 text-muted-foreground/50" aria-hidden="true" />;
  }
  return sortDir === FoodSortDirection.Descending ? (
    <ArrowDown className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowUp className="size-3.5" aria-hidden="true" />
  );
}

interface SortableColumnHeaderProps {
  field: FoodSortField;
  label: string;
  sortBy: FoodSortField | null;
  sortDir: FoodSortDirection;
  onSortChange: (field: FoodSortField) => void;
  sortButtonLabel: string;
}

/** Declared at module scope — a component declared inside `IngredientsTable`'s
 * render body would be re-created every render, resetting its internal state
 * each time (`react-hooks/static-components`). */
function SortableColumnHeader({
  field,
  label,
  sortBy,
  sortDir,
  onSortChange,
  sortButtonLabel,
}: SortableColumnHeaderProps) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1"
      onClick={() => onSortChange(field)}
      aria-label={sortButtonLabel}
    >
      {label}
      <SortIcon active={sortBy === field} sortDir={sortDir} />
    </button>
  );
}

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
  /** Current sort column, or `null` when the list is unsorted (#1139). */
  sortBy: FoodSortField | null;
  sortDir: FoodSortDirection;
  /** Cycles the clicked column's sort state: ascending → descending → cleared. */
  onSortChange: (field: FoodSortField) => void;
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
  sortBy,
  sortDir,
  onSortChange,
}: Props) {
  const { t } = useTranslation();
  const columnCount = isNutritionist ? 6 : 5;

  function sortableHeaderProps(field: FoodSortField, label: string) {
    return {
      field,
      label,
      sortBy,
      sortDir,
      onSortChange,
      sortButtonLabel: t('ingredients.table.sortButtonLabel', { column: label }),
    };
  }

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
          <TableHead className="px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, FoodSortField.Name)}>
            <SortableColumnHeader {...sortableHeaderProps(FoodSortField.Name, t('ingredients.table.columnName'))} />
          </TableHead>
          <TableHead className="w-30 px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, FoodSortField.Calories)}>
            <SortableColumnHeader
              {...sortableHeaderProps(FoodSortField.Calories, t('ingredients.table.columnCalories'))}
            />
          </TableHead>
          <TableHead className="w-45 px-5 py-3">{t('ingredients.table.columnNutrients')}</TableHead>
          <TableHead className="w-45 px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, FoodSortField.Category)}>
            <SortableColumnHeader
              {...sortableHeaderProps(FoodSortField.Category, t('ingredients.table.columnCategory'))}
            />
          </TableHead>
          {isNutritionist && (
            <TableHead className="w-45 px-5 py-3">{t('ingredients.table.columnTags')}</TableHead>
          )}
          <TableHead className="w-25 px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, FoodSortField.Library)}>
            <SortableColumnHeader
              {...sortableHeaderProps(FoodSortField.Library, t('ingredients.table.columnLibrary'))}
            />
          </TableHead>
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
              <TableCell className="px-5 py-3 text-copy font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <IngredientThumbnail foodId={food.foodId} imageUrl={food.imageUrl} name={food.name ?? ''} />
                  <span>{food.name}</span>
                </div>
              </TableCell>
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
