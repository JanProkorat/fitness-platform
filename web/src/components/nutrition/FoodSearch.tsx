import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { searchFoods } from '@/api/foods';
import type { FoodSummary } from '@/api/food-types';

const CATEGORY_ICONS: Record<string, string> = {
  Fruit: '🍎', Vegetables: '🥦', Meat: '🥩', FishAndSeafood: '🐟', Dairy: '🥛',
  GrainsAndCereals: '🌾', Legumes: '🫘', NutsAndSeeds: '🥜', OilsAndFats: '🫒',
  SweetsAndSnacks: '🍫', Beverages: '🥤', Supplements: '💊', Other: '🍽️',
};

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  Fruit: { color: 'var(--green)', bg: 'var(--green-bg)' },
  Vegetables: { color: 'var(--green)', bg: 'var(--green-bg)' },
  Meat: { color: 'var(--red)', bg: 'var(--red-bg)' },
  FishAndSeafood: { color: 'var(--blue)', bg: 'var(--blue-bg)' },
  Dairy: { color: 'var(--purple)', bg: 'var(--purple-bg)' },
  GrainsAndCereals: { color: 'var(--orange)', bg: 'var(--orange-bg)' },
  Legumes: { color: 'var(--green)', bg: 'var(--green-bg)' },
  NutsAndSeeds: { color: 'var(--orange)', bg: 'var(--orange-bg)' },
  OilsAndFats: { color: 'var(--purple)', bg: 'var(--purple-bg)' },
  SweetsAndSnacks: { color: 'var(--red)', bg: 'var(--red-bg)' },
  Beverages: { color: 'var(--blue)', bg: 'var(--blue-bg)' },
  Supplements: { color: 'var(--accent)', bg: 'var(--accent-bg)' },
  Other: { color: 'var(--text3)', bg: 'var(--bg3)' },
};

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
    category?: string | null;
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({ top: 0, left: 0, width: 0, openUp: false });
  const DROPDOWN_MAX_HEIGHT = 240;

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
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;
      setDropdownPos({ top: openUp ? rect.top : rect.bottom, left: rect.left, width: rect.width, openUp });
    }
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
      category: food.category,
    });
    setQuery('');
    setIsOpen(false);
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
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
      {isOpen && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed',
          left: dropdownPos.left, width: dropdownPos.width, zIndex: 1000,
          ...(dropdownPos.openUp ? { bottom: window.innerHeight - dropdownPos.top } : { top: dropdownPos.top }),
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: 'auto',
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
          {filtered.map((food) => {
            const cat = food.category ?? 'Other';
            const catColors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
            return (
              <div
                key={food.foodId}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(food)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(food);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                aria-label={`Select ${food.name}`}
              >
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                  {CATEGORY_ICONS[cat] ?? '🍽️'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {food.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 500, borderRadius: 3,
                        padding: '1px 5px',
                        background: catColors.bg, color: catColors.color,
                      }}
                    >
                      {t(`foods.category${cat}`)}
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {Math.round(food.nutrientValue.kcal)} kcal
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', marginTop: 1 }}>
                    <span style={{ color: 'var(--blue)' }}>{Math.round(food.nutrientValue.protein)}B</span>{' '}
                    <span style={{ color: 'var(--orange)' }}>{Math.round(food.nutrientValue.carbs)}S</span>{' '}
                    <span style={{ color: 'var(--purple)' }}>{Math.round(food.nutrientValue.fat)}T</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
