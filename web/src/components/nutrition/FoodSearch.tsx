import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { searchFoods } from '@/api/foods';
import type { FoodSummary } from '@/api/food-types';

interface FoodSearchProps {
  onSelect: (food: FoodSummary) => void;
  onClose: () => void;
}

export default function FoodSearch({ onSelect, onClose }: FoodSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [results, setResults] = useState<FoodSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
        const data = await searchFoods({ q: query, source: source || undefined, pageSize: 10 });
        setResults(data.foods ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, source]);

  return (
    <div className="rounded-sm border border-border bg-dark2 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('nutrition.searchFoods')}
          className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-gold/40"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-sm border border-border bg-surface px-2 py-2 text-xs text-text outline-none focus:border-gold/40"
        >
          <option value="">{t('foods.sourceAll')}</option>
          <option value="system">{t('foods.sourceSystem')}</option>
          <option value="custom">{t('foods.sourceCustom')}</option>
          <option value="openfoodfacts">{t('foods.sourceOpenFoodFacts')}</option>
        </select>
        <button
          onClick={onClose}
          className="rounded-sm border border-border px-3 py-2 text-xs text-text3 transition-colors hover:text-text"
        >
          {t('common.cancel')}
        </button>
      </div>

      {isLoading && (
        <div className="py-3 text-center text-xs text-text3">{t('common.loading')}</div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          {results.map((food) => (
            <button
              key={food.foodId}
              onClick={() => onSelect(food)}
              className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-gold/5"
            >
              <span className="truncate font-medium">{food.name}</span>
              <span className="ml-3 shrink-0 text-xs text-text3">
                {Math.round(food.nutrientValue.kcal)} kcal |{' '}
                P {Math.round(food.nutrientValue.protein)}g |{' '}
                C {Math.round(food.nutrientValue.carbs)}g |{' '}
                F {Math.round(food.nutrientValue.fat)}g
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && query.trim() && results.length === 0 && (
        <div className="py-3 text-center text-xs text-text3">{t('foods.noFoods')}</div>
      )}
    </div>
  );
}
