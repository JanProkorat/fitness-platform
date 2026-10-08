import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Apple, ChefHat, X } from 'lucide-react';
import type { FoodSummary, MealFood, RecipeSummaryDto } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorStatus } from '@/lib/api-errors';
import { perServing } from '@/lib/recipe-nutrition';
import { cn } from '@/lib/utils';
import { useRecipeInfo } from '@/hooks/useRecipesQueries';

export type LibraryInfoSubject =
  | { kind: 'recipe'; recipe: RecipeSummaryDto }
  | { kind: 'food'; food: FoodSummary; name: string };

const MACRO_COLUMNS = [
  { key: 'protein', dotClass: 'bg-macro-protein', kcalPerGram: 4 },
  { key: 'carbs', dotClass: 'bg-macro-carbs', kcalPerGram: 4 },
  { key: 'fat', dotClass: 'bg-macro-fat', kcalPerGram: 9 },
  { key: 'fiber', dotClass: 'bg-macro-fibre', kcalPerGram: 0 },
] as const;

/** A recipe or ingredient picture, or the same chef-hat / apple tile the Day view uses. */
export function ItemTile({
  imageUrl,
  type,
  className,
  iconClassName,
}: {
  imageUrl?: string;
  type: 'recipe' | 'food';
  className: string;
  iconClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = type === 'recipe' ? ChefHat : Apple;
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-nutrition-soft text-nutrition-ink', className)}
      aria-hidden="true"
    >
      {imageUrl && !failed ? (
        <img src={imageUrl} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon className={iconClassName} />
      )}
    </span>
  );
}

function foodName(food: MealFood, language: string): string {
  const localized = language.startsWith('cs') ? food.foodNameCs : language.startsWith('de') ? food.foodNameDe : food.foodNameEn;
  return localized || food.foodName || '';
}

function RecipeIngredients({ recipeId, servings, language }: { recipeId: string; servings: number; language: string }) {
  const { t } = useTranslation();
  const query = useRecipeInfo(recipeId, true);
  const divisor = servings >= 1 ? servings : 1;

  let body;
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-2 pt-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full rounded-md" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body =
      getErrorStatus(query.error) === 404 ? (
        <p className="border-t border-line pt-2 text-body text-muted-foreground">
          {t('planEditor.library.info.ingredientsUnavailable')}
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-2">
          <p className="text-body text-muted-foreground">{t('planEditor.library.info.ingredientsError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('planEditor.library.retry')}
          </Button>
        </div>
      );
  } else {
    body = (
      <ul>
        {(query.data.foods ?? []).map((food, index) => (
          <li
            key={`${food.foodExternalId ?? ''}:${index}`}
            data-testid="library-info-ingredient"
            className="flex items-center gap-2.5 border-t border-line py-1.5"
          >
            <ItemTile type="food" className="size-6 rounded-md" iconClassName="size-3" />
            <span className="min-w-0 flex-1 text-body text-ink [overflow-wrap:anywhere]">{foodName(food, language)}</span>
            <span className="shrink-0 text-meta text-muted-foreground">
              {Math.round((food.amountGrams ?? 0) / divisor)} {t('planEditor.units.g')}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="pb-1 text-label font-semibold tracking-label text-muted-foreground uppercase">
        {t('planEditor.library.info.ingredientsHeading')}
      </span>
      {body}
    </div>
  );
}

interface Props {
  subject: LibraryInfoSubject;
  language: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Lets the card keep a press on its own button from also counting as an outside click. */
  onInteractOutside: (event: Event) => void;
}

/** Picture, kcal, macros and (for a recipe) the ingredient list of a library card; no preparation steps. */
export default function LibraryInfoPopover({ subject, language, onClose, onCloseAutoFocus, onInteractOutside }: Props) {
  const { t } = useTranslation();
  const isRecipe = subject.kind === 'recipe';
  const name = isRecipe ? (subject.recipe.name ?? '') : subject.name;
  const imageUrl = isRecipe ? subject.recipe.imageUrl : subject.food.imageUrl;
  const servings = isRecipe ? (subject.recipe.servings ?? 1) : 0;
  const macros = isRecipe
    ? perServing(subject.recipe.totalNutrients, subject.recipe.servings)
    : {
        kcal: subject.food.nutrientValue?.kcal ?? 0,
        protein: subject.food.nutrientValue?.protein ?? 0,
        carbs: subject.food.nutrientValue?.carbs ?? 0,
        fat: subject.food.nutrientValue?.fat ?? 0,
        fiber: subject.food.nutrientValue?.fiber ?? 0,
      };
  const tags = (isRecipe ? subject.recipe.tags : subject.food.tags) ?? [];

  return (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={12}
      collisionPadding={16}
      aria-label={name}
      data-testid="library-info"
      onCloseAutoFocus={onCloseAutoFocus}
      onInteractOutside={onInteractOutside}
      className="flex max-h-(--radix-popover-content-available-height) w-90 flex-col gap-3 overflow-y-auto rounded-2xl border-line bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <ItemTile
          imageUrl={imageUrl}
          type={isRecipe ? 'recipe' : 'food'}
          className="size-14 rounded-xl"
          iconClassName="size-7"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-panel-title font-semibold text-ink [overflow-wrap:anywhere]">{name}</span>
          <span className="text-body text-muted-foreground">
            {isRecipe
              ? t('planEditor.library.info.recipeMeta', { count: Math.max(1, Math.round(servings)) })
              : t('planEditor.library.info.foodMeta')}
          </span>
        </span>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-stat font-semibold text-ink">{Math.round(macros.kcal)}</span>
        <span className="text-body text-muted-foreground">
          {t(isRecipe ? 'planEditor.library.info.kcalPerPortion' : 'planEditor.library.info.kcalPer100')}
        </span>
      </div>

      <div className="flex gap-3">
        {MACRO_COLUMNS.map(({ key, dotClass, kcalPerGram }) => {
          const grams = macros[key];
          const share = macros.kcal > 0 ? Math.min(100, ((grams * kcalPerGram) / macros.kcal) * 100) : 0;
          return (
            <div key={key} className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
              <span className="inline-flex items-center gap-1.25 text-meta text-muted-foreground">
                <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                {t(`planEditor.day.${key}`)}
              </span>
              <span className="text-copy font-bold text-ink">
                {Math.round(grams)} {t('planEditor.units.g')}
              </span>
              <span className={cn('h-1 rounded-xs opacity-85', dotClass)} style={{ width: `${share}%` }} aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {isRecipe && (
        <RecipeIngredients recipeId={subject.recipe.recipeId ?? ''} servings={servings} language={language} />
      )}

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag.tagId ?? tag.name}
              className="inline-flex h-6 items-center rounded-full border border-line px-2 text-meta font-semibold text-ink-2"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </PopoverContent>
  );
}
