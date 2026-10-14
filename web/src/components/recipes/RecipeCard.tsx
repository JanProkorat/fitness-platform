import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { RecipeSummaryDto } from '@/api/recipe-types';
import LibraryBadge from '@/components/library/LibraryBadge';
import MacroBar from '@/components/library/MacroBar';
import NutrientDots from '@/components/library/NutrientDots';
import Thumbnail from '@/components/library/Thumbnail';
import TagPill from '@/components/tags/TagPill';
import { recipeImageCacheKey } from '@/hooks/useRecipesQueries';
import { perServing } from '@/lib/recipe-nutrition';

interface Props {
  recipe: RecipeSummaryDto;
  onClick: (recipe: RecipeSummaryDto) => void;
  onViewPicture: (src: string, alt: string) => void;
}

/** Card for one recipe in the grid view; shows the same summary the table row does. */
export default function RecipeCard({ recipe, onClick, onViewPicture }: Props) {
  const { t } = useTranslation();
  const macros = perServing(recipe.totalNutrients, recipe.servings);
  const totalMinutes = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const tags = recipe.tags ?? [];
  const mealTypes = recipe.mealTypes ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(recipe)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick(recipe);
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-panel transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-video w-full bg-muted">
        <Thumbnail
          cacheKey={recipe.recipeId ? recipeImageCacheKey(recipe.recipeId) : undefined}
          imageUrl={recipe.imageUrl}
          name={recipe.name ?? ''}
          onViewPicture={onViewPicture}
          className="size-full rounded-none"
        />
        <div className="absolute top-2.5 left-2.5">
          <LibraryBadge isOwnedByCurrentUser={recipe.isOwnedByCurrentUser} isSystem={recipe.isSystem} />
        </div>
        {totalMinutes > 0 && (
          <Badge variant="outline" className="absolute top-2.5 right-2.5 bg-card text-meta font-semibold">
            {t('recipes.table.minutesValue', { count: totalMinutes })}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-copy font-semibold text-ink">{recipe.name}</span>
          <span className="text-body">
            <span className="font-semibold text-ink">{Math.round(macros.kcal)}</span>{' '}
            <span className="text-ink-2">{t('recipes.table.caloriesUnit')}</span>
          </span>
        </div>
        <NutrientDots
          protein={Math.round(macros.protein)}
          carbs={Math.round(macros.carbs)}
          fat={Math.round(macros.fat)}
          fibre={Math.round(macros.fiber)}
        />
        <MacroBar protein={macros.protein} carbs={macros.carbs} fat={macros.fat} />
        <div className="flex flex-wrap items-center gap-1">
          {mealTypes.map((mealType) => (
            <Badge key={mealType} variant="outline" className="px-2.5 py-1 text-meta font-semibold">
              {t(`recipes.mealType.${mealType}`)}
            </Badge>
          ))}
        </div>
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
