import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FoodSortDirection, RecipeSortField, type RecipeSummaryDto } from '@/api/recipe-types';
import LibraryBadge from '@/components/library/LibraryBadge';
import Thumbnail from '@/components/library/Thumbnail';
import SortableColumnHeader from '@/components/library/SortableColumnHeader';
import { sortAriaValue } from '@/components/library/sortAria';
import { recipeImageCacheKey } from '@/hooks/useRecipesQueries';
import { perServing } from '@/lib/recipe-nutrition';

const SKELETON_ROW_COUNT = 5;
const COLUMN_COUNT = 6;

interface LightboxPicture {
  src: string;
  alt: string;
}

interface Props {
  recipes: RecipeSummaryDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onRowClick: (recipe: RecipeSummaryDto) => void;
  /** Current sort column, or `null` for the server default (newest first). */
  sortBy: RecipeSortField | null;
  sortDir: FoodSortDirection;
  onSortChange: (field: RecipeSortField) => void;
}

/** The Recipes table. Mirrors `IngredientsTable`; values are per serving. */
export default function RecipesTable({
  recipes,
  isPending,
  isError,
  onRetry,
  hasActiveFilter,
  onClearFilters,
  onRowClick,
  sortBy,
  sortDir,
  onSortChange,
}: Props) {
  const { t } = useTranslation();
  const [lightboxPicture, setLightboxPicture] = useState<LightboxPicture | null>(null);

  function sortableHeaderProps(field: RecipeSortField, label: string) {
    return {
      field,
      label,
      sortBy,
      sortDir,
      onSortChange,
      sortButtonLabel: t('library.sortButtonLabel', { column: label }),
    };
  }

  return (
    <>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead className="px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, RecipeSortField.Name)}>
              <SortableColumnHeader {...sortableHeaderProps(RecipeSortField.Name, t('recipes.table.columnName'))} />
            </TableHead>
            <TableHead
              className="w-45 px-5 py-3"
              aria-sort={sortAriaValue(sortBy, sortDir, RecipeSortField.CaloriesPerServing)}
            >
              <SortableColumnHeader
                {...sortableHeaderProps(RecipeSortField.CaloriesPerServing, t('recipes.table.columnCalories'))}
              />
            </TableHead>
            <TableHead className="w-55 px-5 py-3">{t('recipes.table.columnNutrients')}</TableHead>
            <TableHead className="w-45 px-5 py-3">{t('recipes.table.columnMealType')}</TableHead>
            <TableHead className="w-30 px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, RecipeSortField.Servings)}>
              <SortableColumnHeader
                {...sortableHeaderProps(RecipeSortField.Servings, t('recipes.table.columnServings'))}
              />
            </TableHead>
            <TableHead className="w-25 px-5 py-3" aria-sort={sortAriaValue(sortBy, sortDir, RecipeSortField.Library)}>
              <SortableColumnHeader
                {...sortableHeaderProps(RecipeSortField.Library, t('recipes.table.columnLibrary'))}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending &&
            Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isPending && isError && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    {t('recipes.retry')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isPending && !isError && recipes.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-body text-muted-foreground">{t('recipes.noResultsForFilters')}</p>
                  {hasActiveFilter && (
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      {t('recipes.clearFilters')}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isPending &&
            !isError &&
            recipes.map((recipe) => {
              const macros = perServing(recipe.totalNutrients, recipe.servings);
              const subtitleParts = [
                t('recipes.table.ingredientsCount', { count: recipe.foodCount ?? 0 }),
                ...(recipe.prepTimeMinutes || recipe.cookTimeMinutes
                  ? [
                      t('recipes.table.minutesValue', {
                        count: (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0),
                      }),
                    ]
                  : []),
              ];
              return (
                <TableRow key={recipe.recipeId} className="cursor-pointer" onClick={() => onRowClick(recipe)}>
                  <TableCell className="px-5 py-3 text-copy font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Thumbnail
                        cacheKey={recipe.recipeId ? recipeImageCacheKey(recipe.recipeId) : undefined}
                        imageUrl={recipe.imageUrl}
                        name={recipe.name ?? ''}
                        onViewPicture={(src, alt) => setLightboxPicture({ src, alt })}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span>{recipe.name}</span>
                        <span className="text-meta font-normal text-muted-foreground">{subtitleParts.join(' · ')}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-45 px-5 py-3 text-body font-medium text-muted-foreground">
                    {t('recipes.table.caloriesValue', { count: Math.round(macros.kcal) })}
                  </TableCell>
                  <TableCell className="w-55 px-5 py-3 text-meta text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{t('recipes.table.proteinValue', { count: Math.round(macros.protein) })}</span>
                      <span>{t('recipes.table.carbsValue', { count: Math.round(macros.carbs) })}</span>
                      <span>{t('recipes.table.fatValue', { count: Math.round(macros.fat) })}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-45 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(recipe.mealTypes ?? []).map((mealType) => (
                        <Badge key={mealType} variant="library">
                          {t(`recipes.mealType.${mealType}`)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="w-30 px-5 py-3 text-body text-muted-foreground">{recipe.servings}</TableCell>
                  <TableCell className="w-25 px-5 py-3">
                    <LibraryBadge isOwnedByCurrentUser={recipe.isOwnedByCurrentUser} isSystem={recipe.isSystem} />
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      <ImageLightbox
        open={lightboxPicture !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLightboxPicture(null);
          }
        }}
        src={lightboxPicture?.src ?? ''}
        alt={lightboxPicture?.alt ?? ''}
      />
    </>
  );
}
