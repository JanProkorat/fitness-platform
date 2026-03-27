import { useState, useRef, useEffect, useCallback } from 'react';
import { searchRecipes } from '@/api/recipes';
import type { RecipeSummary } from '@/api/recipe-types';

export interface RecipeSearchProps {
  onSelect: (recipe: {
    recipeId: string;
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
  placeholder?: string;
}

export function RecipeSearch({
  onSelect,
  placeholder = 'Přidat recept...',
}: RecipeSearchProps) {
  const [query, setQuery] = useState('');
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRecipes = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await searchRecipes({ pageSize: 100 });
      setAllRecipes(res.recipes);
      setLoaded(true);
    } catch {
      // silent
    }
  }, [loaded]);

  const handleFocus = () => {
    setIsOpen(true);
    loadRecipes();
  };

  const filtered = query.length >= 3
    ? allRecipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : allRecipes;

  function handleSelect(recipe: RecipeSummary) {
    onSelect({
      recipeId: recipe.recipeId,
      name: recipe.name,
      kcal: recipe.totalNutrients.kcal,
      protein: recipe.totalNutrients.protein,
      carbs: recipe.totalNutrients.carbs,
      fat: recipe.totalNutrients.fat,
    });
    setQuery('');
    setIsOpen(false);
  }

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
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 200,
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {!loaded && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              Načítání...
            </div>
          )}
          {loaded && filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {query.length >= 3 ? 'Žádné výsledky' : 'Žádné recepty'}
            </div>
          )}
          {filtered.map((recipe) => (
            <div
              key={recipe.recipeId}
              onClick={() => handleSelect(recipe)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📖 {recipe.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {Math.round(recipe.totalNutrients.kcal)} kcal ·{' '}
                <span style={{ color: 'var(--blue)' }}>{Math.round(recipe.totalNutrients.protein)}B</span>{' '}
                <span style={{ color: 'var(--orange)' }}>{Math.round(recipe.totalNutrients.carbs)}S</span>{' '}
                <span style={{ color: 'var(--purple)' }}>{Math.round(recipe.totalNutrients.fat)}T</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
