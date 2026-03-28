import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { FoodRow } from './FoodRow';
import { FoodSearch } from './FoodSearch';
import { RecipeRow } from './RecipeRow';
import { RecipeSearch } from './RecipeSearch';

function MealDropZone({ mealId, itemIds, onItemDrop, onReorder, children }: {
  mealId?: string;
  itemIds: string[];
  onItemDrop?: (data: { type: string; foodId?: string; recipeId?: string; mealId: string; dayOfWeek?: number }) => void;
  onReorder?: (itemIds: string[]) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={{
        minHeight: 24,
        borderRadius: 'var(--radius)',
        transition: 'background 0.15s',
        background: over ? 'var(--accent-bg)' : undefined,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!mealId) return;
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data.mealId && data.mealId !== mealId) {
            // Cross-meal move
            onItemDrop?.({ ...data, targetMealId: mealId });
          } else if (data.mealId === mealId && onReorder) {
            // Same-meal reorder: find what was dropped and where
            const draggedId = data.foodId || data.recipeId;
            if (!draggedId) return;
            // Find target row from mouse position
            const container = e.currentTarget;
            const rows = Array.from(container.querySelectorAll('[data-item-id]'));
            let targetIndex = rows.length; // default: end
            for (let i = 0; i < rows.length; i++) {
              const rect = rows[i].getBoundingClientRect();
              if (e.clientY < rect.top + rect.height / 2) {
                targetIndex = i;
                break;
              }
            }
            const oldIndex = itemIds.indexOf(draggedId);
            if (oldIndex === -1 || oldIndex === targetIndex) return;
            const newOrder = [...itemIds];
            newOrder.splice(oldIndex, 1);
            newOrder.splice(targetIndex > oldIndex ? targetIndex - 1 : targetIndex, 0, draggedId);
            onReorder(newOrder);
          }
        } catch { /* ignore */ }
      }}
    >
      {children}
    </div>
  );
}

function MealNoteInput({ note, onChange }: { note?: string | null; onChange: (note: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(note ?? '');
  return (
    <div style={{ padding: '4px 8px 6px' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onChange(value)}
        placeholder={t('nutrition.mealNotePlaceholder')}
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', fontStyle: 'italic',
          padding: '2px 4px', borderRadius: 'var(--radius)', transition: 'background 0.1s',
        }}
        onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
        onBlurCapture={(e) => { e.target.style.background = 'transparent'; }}
      />
    </div>
  );
}

export interface MealBlockFood {
  id: string;
  name: string;
  amount: number;
  unit?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string | null;
  category?: string | null;
}

export interface MealBlockRecipe {
  recipeId: string;
  recipeName: string;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string | null;
}

export interface MealBlockProps {
  mealId?: string;
  name: string;
  time?: string;
  note?: string | null;
  foods: MealBlockFood[];
  recipes?: MealBlockRecipe[];
  isOpen: boolean;
  onToggle: () => void;
  onFoodAmountChange: (foodId: string, amount: number) => void;
  onFoodRemove: (foodId: string) => void;
  onFoodNoteChange?: (foodId: string, note: string) => void;
  onAddFood?: () => void;
  onFoodSelect?: (food: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
  onRecipeSelect?: (recipe: { recipeId: string; name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
  onRecipeServingsChange?: (recipeId: string, servings: number) => void;
  onRecipeRemove?: (recipeId: string) => void;
  onRecipeNoteChange?: (recipeId: string, note: string) => void;
  mealTotalKcal: number;
  onNameChange?: (name: string) => void;
  onNoteChange?: (note: string) => void;
  onItemDrop?: (data: { type: string; foodId?: string; recipeId?: string; mealId: string; dayOfWeek?: number }) => void;
  onReorder?: (itemIds: string[]) => void;
  dayOfWeek?: number;
  weekNumber?: number;
  onTimeChange?: (time: string) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
}

export function MealBlock({
  mealId,
  name,
  time,
  foods,
  isOpen,
  onToggle,
  onFoodAmountChange,
  onFoodRemove,
  onAddFood,
  onFoodSelect,
  recipes,
  onRecipeSelect,
  onRecipeServingsChange,
  onRecipeRemove,
  onRecipeNoteChange,
  mealTotalKcal,
  onNameChange,
  onItemDrop,
  onReorder,
  onNoteChange,
  onFoodNoteChange,
  dayOfWeek,
  weekNumber,
  onTimeChange,
  onDuplicate,
  onRemove,
  note,
}: MealBlockProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNameChange) {
      setEditValue(name);
      setEditing(true);
    }
  };

  const handleFinishEdit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name && onNameChange) {
      onNameChange(trimmed);
    }
  };

  return (
    <div className="mb-3 rounded-md border border-border bg-bg transition-all duration-100 hover:border-border-md">
      {/* Header */}
      <div
        className={cn(
          'group flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-bg-hover',
          isOpen && 'border-b border-border',
        )}
        onClick={onToggle}
      >
        <span
          className={cn(
            'text-[10px] text-text3 transition-transform duration-150 w-3 inline-flex items-center justify-center',
            isOpen && 'rotate-90',
          )}
        >
          ▶
        </span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEdit(); if (e.key === 'Escape') setEditing(false); }}
              onClick={(e) => e.stopPropagation()}
              className="auth-input"
              style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '1px 4px' }}
            />
          ) : (
            <span
              className="text-[13px] font-semibold block truncate"
              onClick={(e) => { if (onNameChange) { e.stopPropagation(); handleStartEdit(e); } }}
              style={onNameChange ? { cursor: 'text', borderRadius: 'var(--radius)', padding: '1px 4px', transition: 'background 0.1s' } : undefined}
              onMouseEnter={(e) => { if (onNameChange) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (onNameChange) e.currentTarget.style.background = ''; }}
            >
              {name}
            </span>
          )}
        </div>
        {onTimeChange && (
          <input
            type="time"
            value={time ?? ''}
            onChange={(e) => { e.stopPropagation(); onTimeChange(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit',
              padding: '1px 4px', borderRadius: 'var(--radius)',
              cursor: 'pointer', width: 70, transition: 'background 0.1s',
            }}
            onFocus={(e) => { e.target.style.background = 'var(--bg-hover)'; }}
            onBlur={(e) => { e.target.style.background = 'transparent'; }}
          />
        )}
        {!onTimeChange && time && <span className="text-xs text-text3">{time}</span>}
        {onDuplicate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
              transition: 'color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
            title={t('nutrition.duplicateMeal')}
          >
            ⧉
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              fontSize: 11, color: 'var(--text4)', borderRadius: 'var(--radius)',
              transition: 'color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
            title={t('nutrition.removeMeal')}
          >
            ✕
          </button>
        )}
      </div>

      <div className="collapse-grid" data-open={isOpen}>
        <div className="collapse-content">
          {/* Meal note */}
          {onNoteChange && (
            <MealNoteInput note={note} onChange={onNoteChange} />
          )}

          {/* Column header row */}
          <div className="grid gap-1 px-2 py-1" style={{ gridTemplateColumns: '1fr minmax(80px, 1fr) 68px 50px 40px 40px 40px 22px' }}>
            <span className="text-[11px] text-text3 font-medium">{t('nutrition.item')}</span>
            <span className="text-[11px] text-text3 font-medium">{t('nutrition.note')}</span>
            <span className="text-[11px] text-text3 font-medium">{t('nutrition.amount')}</span>
            <span className="text-[11px] text-text3 font-medium text-right">kcal</span>
            <span className="text-[11px] font-medium text-right" style={{ color: 'var(--blue)' }}>{t('nutrition.proteinShort')}</span>
            <span className="text-[11px] font-medium text-right" style={{ color: 'var(--orange)' }}>{t('nutrition.carbsShort')}</span>
            <span className="text-[11px] font-medium text-right" style={{ color: 'var(--purple)' }}>{t('nutrition.fatShort')}</span>
            <span />
          </div>

          {/* Droppable zone for foods & recipes */}
          <MealDropZone
            mealId={mealId}
            itemIds={[...foods.map(f => f.id), ...(recipes ?? []).map(r => r.recipeId)]}
            onItemDrop={onItemDrop}
            onReorder={onReorder}
          >
            {foods.map((food, fi) => (
              <FoodRow
                key={food.id}
                food={food}
                index={fi}
                mealId={mealId}
                dayOfWeek={dayOfWeek}
                weekNumber={weekNumber}
                onAmountChange={(amount) => onFoodAmountChange(food.id, amount)}
                onRemove={() => onFoodRemove(food.id)}
                onNoteChange={onFoodNoteChange ? (n) => onFoodNoteChange(food.id, n) : undefined}
              />
            ))}

            {(recipes ?? []).map((recipe, ri) => (
              <RecipeRow
                key={recipe.recipeId}
                index={foods.length + ri}
                mealId={mealId}
                dayOfWeek={dayOfWeek}
                weekNumber={weekNumber}
                recipe={recipe}
                onServingsChange={(s) => onRecipeServingsChange?.(recipe.recipeId, s)}
                onRemove={() => onRecipeRemove?.(recipe.recipeId)}
                onNoteChange={onRecipeNoteChange ? (n) => onRecipeNoteChange(recipe.recipeId, n) : undefined}
              />
            ))}
          </MealDropZone>

          {/* Summary row */}
          {(foods.length > 0 || (recipes ?? []).length > 0) && (() => {
            const totalKcal = foods.reduce((s, f) => s + f.kcal, 0)
              + (recipes ?? []).reduce((s, r) => s + r.kcal * r.servings, 0);
            const totalP = foods.reduce((s, f) => s + f.protein, 0)
              + (recipes ?? []).reduce((s, r) => s + r.protein * r.servings, 0);
            const totalC = foods.reduce((s, f) => s + f.carbs, 0)
              + (recipes ?? []).reduce((s, r) => s + r.carbs * r.servings, 0);
            const totalF = foods.reduce((s, f) => s + f.fat, 0)
              + (recipes ?? []).reduce((s, r) => s + r.fat * r.servings, 0);
            return (
              <div
                className="grid gap-1 px-2 py-[5px] items-center"
                style={{
                  gridTemplateColumns: '1fr minmax(80px, 1fr) 68px 50px 40px 40px 40px 22px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{t('nutrition.total')}</div>
                <div />
                <div />
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{Math.round(totalKcal)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', color: 'var(--blue)' }}>{Math.round(totalP)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', color: 'var(--orange)' }}>{Math.round(totalC)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', color: 'var(--purple)' }}>{Math.round(totalF)}</div>
                <div />
              </div>
            );
          })()}

          {/* Add food dropdown */}
          {onFoodSelect && <FoodSearch onSelect={onFoodSelect} />}

          {/* Add recipe dropdown */}
          {onRecipeSelect && <RecipeSearch onSelect={onRecipeSelect} />}
        </div>
      </div>
    </div>
  );
}
