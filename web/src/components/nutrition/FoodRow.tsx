import { useState, useRef } from 'react';

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
    note?: string | null;
  };
  index?: number;
  mealId?: string;
  onAmountChange: (amount: number) => void;
  onRemove: () => void;
  onNoteChange?: (note: string) => void;
}

export function FoodRow({ food, index, mealId, onAmountChange, onRemove, onNoteChange }: FoodRowProps) {
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  }

  function handleNoteBlur() {
    if (onNoteChange) {
      onNoteChange(localNote);
    }
  }

  return (
    <div
      draggable={!!mealId}
      onDragStart={(e) => {
        if (mealId) {
          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'food', foodId: food.id, mealId }));
          e.dataTransfer.effectAllowed = 'move';
        }
      }}
      data-item-id={food.id}
      className="grid gap-1 px-2 py-[5px] items-center transition-colors hover:bg-bg-hover group"
      style={{
        gridTemplateColumns: '1fr minmax(80px, 1fr) 68px 50px 36px 36px 36px 22px',
        cursor: mealId ? 'grab' : undefined,
      }}
    >
      <div className="text-[13px] truncate"><span style={{ marginRight: 4 }}>🍎</span>{food.name}</div>
      {onNoteChange ? (
        <input
          type="text"
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="poznámka..."
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
        <div className="text-[11px] text-text3 italic truncate">{food.note || ''}</div>
      )}
      <div className="flex items-center gap-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={localAmount}
          onChange={(e) => setLocalAmount(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-xs text-text3 rounded-sm px-[3px] py-[1px] outline-none transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md"
        />
        <span className="text-[11px] text-text4 shrink-0">
          {food.unit ?? 'g'}
        </span>
      </div>
      <div className="text-xs text-right tabular-nums">{Math.round(food.kcal)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(food.protein)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(food.carbs)}</div>
      <div className="text-xs text-right tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(food.fat)}</div>
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
