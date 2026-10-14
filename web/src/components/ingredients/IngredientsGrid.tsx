import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { FoodSummary } from '@/api/food-types';
import IngredientCard from '@/components/ingredients/IngredientCard';

const SKELETON_CARD_COUNT = 6;
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(var(--container-3xs),1fr))] gap-4 p-4';

interface Props {
  foods: FoodSummary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onCardClick: (food: FoodSummary) => void;
}

/** The Ingredients card grid; takes the same summary items as `IngredientsTable`. */
export default function IngredientsGrid({
  foods,
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
          {t('ingredients.retry')}
        </Button>
      </div>
    );
  }

  if (foods.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-body text-muted-foreground">{t('ingredients.noResultsForFilters')}</p>
        {hasActiveFilter && (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
            {t('ingredients.clearFilters')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={GRID_CLASS}>
        {foods.map((food) => (
          <IngredientCard
            key={food.foodId}
            food={food}
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
