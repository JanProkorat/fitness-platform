import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecipeSummaryDto } from '@/api/recipe-types';
import RecipeCard from '@/components/recipes/RecipeCard';

const SKELETON_CARD_COUNT = 6;
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(var(--container-3xs),1fr))] gap-3.5';

interface Props {
  recipes: RecipeSummaryDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onCardClick: (recipe: RecipeSummaryDto) => void;
}

/** The Recipes card grid; takes the same summary items as `RecipesTable`. */
export default function RecipesGrid({
  recipes,
  isPending,
  isError,
  onRetry,
  hasActiveFilter,
  onClearFilters,
  onCardClick,
}: Props) {
  const { t } = useTranslation();
  const [lightboxPicture, setLightboxPicture] = useState<{ src: string; alt: string } | null>(null);

  if (isPending) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          <Skeleton key={index} className="h-72 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('recipes.retry')}
        </Button>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-body text-muted-foreground">{t('recipes.noResultsForFilters')}</p>
        {hasActiveFilter && (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
            {t('recipes.clearFilters')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={GRID_CLASS}>
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.recipeId}
            recipe={recipe}
            onClick={onCardClick}
            onViewPicture={(src, alt) => setLightboxPicture({ src, alt })}
          />
        ))}
      </div>
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
