import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS, CATEGORY_COLORS } from './food-category';

export interface FoodRowProps {
  food: {
    id: string;
    name: string;
    amount: number;
    unit?: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    note?: string | null;
    category?: string | null;
  };
  index?: number;
  mealId?: string;
  dayOfWeek?: number;
  weekNumber?: number;
  onAmountChange: (amount: number) => void;
  onRemove: () => void;
  onNoteChange?: (note: string) => void;
  accentColor?: string;
}

export function FoodRow({ food, index: _index, mealId, dayOfWeek, weekNumber, onAmountChange, onRemove, onNoteChange, accentColor: _accentColor }: FoodRowProps) {
  const { t } = useTranslation();
  const accentColor = CATEGORY_COLORS[food.category ?? ''] ?? _accentColor;
  const [localAmount, setLocalAmount] = useState(String(food.amount));
  const [localNote, setLocalNote] = useState(food.note ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleBlur() {
    const parsed = parseFloat(localAmount);
    if (!isNaN(parsed) && parsed > 0) {
      onAmountChange(parsed);
    } else {
      setLocalAmount(String(food.amount));
    }
  }

  function handleNoteBlur() {
    if (onNoteChange) onNoteChange(localNote);
  }

  return (
    <div
      draggable={!!mealId}
      onDragStart={(e) => {
        if (mealId) {
          e.stopPropagation();
          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'food', foodId: food.id, mealId, dayOfWeek, weekNumber }));
          e.dataTransfer.effectAllowed = 'move';
        }
      }}
      data-item-id={food.id}
      className="rounded-md border border-border bg-bg overflow-hidden transition-all duration-100 hover:border-border-md group"
      style={{ cursor: mealId ? 'grab' : undefined }}
    >
      <div className="flex items-stretch gap-2 py-2 pl-2 pr-3">
        {/* Color bar */}
        {accentColor && <div className="w-[4px] self-stretch shrink-0 rounded-full" style={{ background: accentColor }} />}

        {/* Left: name + badges */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="text-[13px] font-semibold text-text truncate">{food.name}</div>
          <div className="flex items-center gap-2 flex-wrap">
            {food.category && (
              <span
                className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: CATEGORY_COLORS[food.category] ?? 'var(--text3)',
                  background: `color-mix(in srgb, ${CATEGORY_COLORS[food.category] ?? 'var(--text3)'} 12%, transparent)`,
                }}
              >
                {CATEGORY_ICONS[food.category] ?? '🍽️'} {t(`foods.category${food.category}`)}
              </span>
            )}
            <span className="text-[11px] tabular-nums text-text2 font-medium">{Math.round(food.kcal)} kcal</span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(food.protein)}{t('nutrition.proteinShort')}</span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(food.carbs)}{t('nutrition.carbsShort')}</span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(food.fat)}{t('nutrition.fatShort')}</span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--green)' }}>{Math.round(food.fiber ?? 0)}{t('nutrition.fiberShort')}</span>
          </div>
        </div>

        {/* Right: note + grams + remove */}
        <div className="flex items-center gap-1 shrink min-w-0">
          {onNoteChange && (
            <input
              type="text"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder={t('nutrition.foodNotePlaceholder')}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
                padding: '1px 3px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
                flex: '0 1 360px', minWidth: 80,
              }}
              onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
              onBlurCapture={(e) => { e.target.style.background = 'transparent'; }}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={localAmount}
            onChange={(e) => setLocalAmount(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.blur(); }}
            className="w-12 bg-transparent text-xs text-text3 rounded-sm px-[3px] py-[1px] outline-none text-right transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md"
          />
          <span className="text-[11px] text-text4">{food.unit ?? 'g'}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-text4 cursor-pointer transition-all hover:text-red shrink-0 ml-1"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
