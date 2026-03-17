import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { searchRecipes, getRecipe } from '@/api/recipes';
import type { RecipeSummary } from '@/api/recipe-types';
import type { RecipeDetail } from '@/api/recipe-types';

interface RecipeSearchProps {
  onSelect: (recipe: RecipeDetail) => void;
  onClose: () => void;
}

export default function RecipeSearch({ onSelect, onClose }: RecipeSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchRecipes({ search: query, page: 1, pageSize: 10 });
        setResults(data.recipes ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (recipe: RecipeSummary) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getRecipe(recipe.recipeId);
      onSelect(detail);
    } catch {
      // silently ignore – user can retry
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="rounded-sm border border-border bg-dark2 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('recipes.searchRecipes')}
          className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-gold/40"
        />
        <button
          onClick={onClose}
          className="rounded-sm border border-border px-3 py-2 text-xs text-text3 transition-colors hover:text-text"
        >
          {t('common.cancel')}
        </button>
      </div>

      {(isLoading || isLoadingDetail) && (
        <div className="py-3 text-center text-xs text-text3">{t('common.loading')}</div>
      )}

      {!isLoading && !isLoadingDetail && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          {results.map((recipe) => (
            <button
              key={recipe.recipeId}
              onClick={() => handleSelect(recipe)}
              className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-gold/5"
            >
              <span className="truncate font-medium">{recipe.name}</span>
              <span className="ml-3 shrink-0 text-xs text-text3">
                {recipe.foodCount} {t('recipes.foods')} |{' '}
                {Math.round(recipe.totalNutrients.kcal)} kcal
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isLoadingDetail && query.trim() && results.length === 0 && (
        <div className="py-3 text-center text-xs text-text3">{t('recipes.noResults')}</div>
      )}
    </div>
  );
}
