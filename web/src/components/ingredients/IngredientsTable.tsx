import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FoodSummary } from '@/api/food-types';
import LibraryBadge from '@/components/ingredients/LibraryBadge';

const COLUMN_COUNT = 5;
const SKELETON_ROW_COUNT = 5;

interface Props {
  foods: FoodSummary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onRowClick: (food: FoodSummary) => void;
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
}: Props) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader className="bg-muted">
        <TableRow>
          <TableHead>{t('ingredients.table.columnName')}</TableHead>
          <TableHead>{t('ingredients.table.columnCalories')}</TableHead>
          <TableHead>{t('ingredients.table.columnNutrients')}</TableHead>
          <TableHead>{t('ingredients.table.columnCategory')}</TableHead>
          <TableHead>{t('ingredients.table.columnLibrary')}</TableHead>
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
                  {t('ingredients.retry')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isPending && !isError && foods.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
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
              <TableCell className="font-medium text-foreground">{food.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {t('ingredients.table.caloriesValue', { count: food.nutrientValue?.kcal ?? 0 })}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex items-center gap-2 text-caption">
                  <span>{t('ingredients.table.proteinValue', { count: food.nutrientValue?.protein ?? 0 })}</span>
                  <span>{t('ingredients.table.carbsValue', { count: food.nutrientValue?.carbs ?? 0 })}</span>
                  <span>{t('ingredients.table.fatValue', { count: food.nutrientValue?.fat ?? 0 })}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {food.category && t(`ingredients.category.${food.category}`)}
              </TableCell>
              <TableCell>
                <LibraryBadge isOwnedByCurrentUser={food.isOwnedByCurrentUser} />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
