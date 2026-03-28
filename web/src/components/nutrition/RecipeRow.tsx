import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface RecipeRowProps {
  recipe: {
    recipeId: string;
    recipeName: string;
    servings: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    note?: string | null;
  };
  index?: number;
  mealId?: string;
  dayOfWeek?: number;
  weekNumber?: number;
  onServingsChange: (servings: number) => void;
  onRemove: () => void;
  onNoteChange?: (note: string) => void;
}

export function RecipeRow({ recipe, index: _index, mealId, dayOfWeek, weekNumber, onServingsChange, onRemove, onNoteChange }: RecipeRowProps) {
  const { t } = useTranslation();
  const [localServings, setLocalServings] = useState(String(recipe.servings));
  const [localNote, setLocalNote] = useState(recipe.note ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleBlur() {
    const parsed = parseFloat(localServings);
    if (!isNaN(parsed) && parsed > 0) {
      onServingsChange(parsed);
    } else {
      setLocalServings(String(recipe.servings));
    }
  }

  return (
    <div
      draggable={!!mealId}
      onDragStart={(e) => {
        if (mealId) {
          e.stopPropagation();
          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'recipe', recipeId: recipe.recipeId, mealId, dayOfWeek, weekNumber }));
          e.dataTransfer.effectAllowed = 'move';
        }
      }}
      data-item-id={recipe.recipeId}
      className="grid gap-1 px-2 py-[5px] items-center transition-colors hover:bg-bg-hover group"
      style={{
        gridTemplateColumns: '1fr minmax(80px, 1fr) 68px 50px 36px 36px 36px 22px',
        cursor: mealId ? 'grab' : undefined,
      }}
    >
      <div className="text-[13px] truncate">📖 {recipe.recipeName}</div>
      {onNoteChange ? (
        <input
          type="text"
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => onNoteChange(localNote)}
          placeholder={t('nutrition.foodNotePlaceholder')}
          style={{
            width: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
            padding: '1px 3px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
            minWidth: 0,
          }}
          onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
          onBlurCapture={(e) => { e.target.style.background = 'transparent'; }}
        />
      ) : (
        <div className="text-[11px] text-text3 italic truncate">{recipe.note || ''}</div>
      )}
      <div className="flex items-center gap-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={localServings}
          onChange={(e) => setLocalServings(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.blur(); }}
          className="w-full bg-transparent text-xs text-text3 rounded-sm px-[3px] py-[1px] outline-none transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md"
        />
        <span className="text-[11px] text-text4 shrink-0">{t('nutrition.servings')}</span>
      </div>
      <div className="text-xs text-right tabular-nums">{Math.round(recipe.kcal * recipe.servings)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(recipe.protein * recipe.servings)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(recipe.carbs * recipe.servings)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(recipe.fat * recipe.servings)}</div>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-[11px] text-text4 cursor-pointer text-center transition-all hover:text-red"
        aria-label="Odebrat"
      >
        ✕
      </button>
    </div>
  );
}
