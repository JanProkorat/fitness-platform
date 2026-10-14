import { useTranslation } from 'react-i18next';
import type { FoodSummary } from '@/api/food-types';
import LibraryBadge from '@/components/library/LibraryBadge';
import MacroBar from '@/components/library/MacroBar';
import NutrientDots from '@/components/library/NutrientDots';
import Thumbnail from '@/components/library/Thumbnail';
import TagPill from '@/components/tags/TagPill';
import { foodImageCacheKey } from '@/hooks/useIngredientsQueries';

interface Props {
  food: FoodSummary;
  onClick: (food: FoodSummary) => void;
  onViewPicture: (src: string, alt: string) => void;
}

/** Card for one ingredient in the grid view; shows the same summary the table row does. */
export default function IngredientCard({ food, onClick, onViewPicture }: Props) {
  const { t } = useTranslation();
  const nutrients = food.nutrientValue;
  const tags = food.tags ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(food)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick(food);
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-panel transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-video w-full bg-muted">
        <Thumbnail
          cacheKey={food.foodId ? foodImageCacheKey(food.foodId) : undefined}
          imageUrl={food.imageUrl}
          name={food.name ?? ''}
          onViewPicture={onViewPicture}
          className="size-full rounded-none"
        />
        <div className="absolute top-2.5 left-2.5">
          <LibraryBadge isOwnedByCurrentUser={food.isOwnedByCurrentUser} isSystem={food.isSystem} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-copy font-semibold text-ink">{food.name}</span>
          <span className="text-body">
            <span className="font-semibold text-ink">{nutrients?.kcal ?? 0}</span>{' '}
            <span className="text-ink-2">{t('ingredients.table.caloriesUnit')}</span>
          </span>
        </div>
        <NutrientDots
          protein={nutrients?.protein ?? 0}
          carbs={nutrients?.carbs ?? 0}
          fat={nutrients?.fat ?? 0}
          fibre={nutrients?.fiber ?? 0}
        />
        <MacroBar protein={nutrients?.protein ?? 0} carbs={nutrients?.carbs ?? 0} fat={nutrients?.fat ?? 0} />
        {food.category && (
          <span className="text-body text-ink-2">{t(`ingredients.category.${food.category}`)}</span>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1">
          {tags.length > 0 ? (
            tags.map((tag) => <TagPill key={tag.tagId} name={tag.name ?? ''} colorHex={tag.colorHex} variant="table" />)
          ) : (
            <span className="text-meta text-muted-foreground">{t('library.viewMode.noTags')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
