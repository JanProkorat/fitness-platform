import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { searchFoods } from '@/api/foods';
import type { FoodSummary } from '@/api/food-types';

export interface FoodSearchProps {
  onSelect: (food: {
    name: string;
    nameCs?: string | null;
    nameEn?: string | null;
    nameDe?: string | null;
    foodId: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
  placeholder?: string;
}

export function FoodSearch({
  onSelect,
  placeholder,
}: FoodSearchProps) {
  const { t, i18n } = useTranslation();
  const effectivePlaceholder = placeholder ?? t('nutrition.addFood');
  const [query, setQuery] = useState('');
  const [allFoods, setAllFoods] = useState<FoodSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadedLang, setLoadedLang] = useState('');

  // Reset cache when language changes
  if (loaded && loadedLang !== i18n.language) {
    setLoaded(false);
    setAllFoods([]);
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all foods on first open
  const loadFoods = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await searchFoods({ pageSize: 100 });
      setAllFoods(res.foods);
      setLoaded(true);
      setLoadedLang(i18n.language);
    } catch {
      // silent
    }
  }, [loaded, i18n.language]);

  const handleFocus = () => {
    setIsOpen(true);
    loadFoods();
  };

  // Filter: show all if query < 3 chars, otherwise filter by name
  const filtered = query.length >= 3
    ? allFoods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
    : allFoods;

  function handleSelect(food: FoodSummary) {
    onSelect({
      name: food.name,
      nameCs: food.nameCs,
      nameEn: food.nameEn,
      nameDe: food.nameDe,
      foodId: food.foodId,
      kcal: food.nutrientValue.kcal,
      protein: food.nutrientValue.protein,
      carbs: food.nutrientValue.carbs,
      fat: food.nutrientValue.fat,
    });
    setQuery('');
    setIsOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Input styled as the add food row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          cursor: 'text', transition: 'background 0.1s',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <span style={{ color: 'var(--text4)', fontSize: 13 }}>+</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={effectivePlaceholder}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 200,
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {!loaded && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {t('nutrition.loading')}
            </div>
          )}
          {loaded && filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {query.length >= 3 ? t('nutrition.noResults') : t('nutrition.noFoods')}
            </div>
          )}
          {filtered.map((food) => (
            <div
              key={food.foodId}
              onClick={() => handleSelect(food)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {food.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {Math.round(food.nutrientValue.kcal)} kcal ·{' '}
                <span style={{ color: 'var(--blue)' }}>{Math.round(food.nutrientValue.protein)}B</span>{' '}
                <span style={{ color: 'var(--orange)' }}>{Math.round(food.nutrientValue.carbs)}S</span>{' '}
                <span style={{ color: 'var(--purple)' }}>{Math.round(food.nutrientValue.fat)}T</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
