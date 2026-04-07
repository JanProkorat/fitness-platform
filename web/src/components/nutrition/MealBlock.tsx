import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { FoodRow } from './FoodRow';
import { FoodSearch } from './FoodSearch';
import { RecipeRow } from './RecipeRow';
import { RecipeSearch } from './RecipeSearch';
import { MEAL_KIND_CONFIG, type MealKind } from './meal-kind';

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
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
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
  fiber?: number;
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
  fiber?: number;
  note?: string | null;
  foodCategories?: string[];
}

export interface MealBlockProps {
  mealId?: string;
  kind: string;
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
  kind,
  time,
  foods,
  isOpen,
  onToggle,
  onFoodAmountChange,
  onFoodRemove,
  onAddFood: _onAddFood,
  onFoodSelect,
  recipes,
  onRecipeSelect,
  onRecipeServingsChange,
  onRecipeRemove,
  onRecipeNoteChange,
  mealTotalKcal: _mealTotalKcal,
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
  const accentColor = MEAL_KIND_CONFIG[kind as MealKind]?.color;

  const totalKcal = foods.reduce((s, f) => s + f.kcal, 0) + (recipes ?? []).reduce((s, r) => s + r.kcal * r.servings, 0);
  const totalP = foods.reduce((s, f) => s + f.protein, 0) + (recipes ?? []).reduce((s, r) => s + r.protein * r.servings, 0);
  const totalC = foods.reduce((s, f) => s + f.carbs, 0) + (recipes ?? []).reduce((s, r) => s + r.carbs * r.servings, 0);
  const totalF = foods.reduce((s, f) => s + f.fat, 0) + (recipes ?? []).reduce((s, r) => s + r.fat * r.servings, 0);
  const totalFi = foods.reduce((s, f) => s + (f.fiber ?? 0), 0) + (recipes ?? []).reduce((s, r) => s + (r.fiber ?? 0) * r.servings, 0);
  const hasItems = foods.length > 0 || (recipes ?? []).length > 0;

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
        <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{t(`mealKind.${kind}`)}</span>
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
        {hasItems && (
          <div className="flex items-center gap-2 text-[11px] tabular-nums" onClick={(e) => e.stopPropagation()}>
            <span className="font-semibold text-text2">{Math.round(totalKcal)} kcal</span>
            <span style={{ color: 'var(--blue)' }}>{Math.round(totalP)}{t('nutrition.proteinShort')}</span>
            <span style={{ color: 'var(--orange)' }}>{Math.round(totalC)}{t('nutrition.carbsShort')}</span>
            <span style={{ color: 'var(--purple)' }}>{Math.round(totalF)}{t('nutrition.fatShort')}</span>
            <span style={{ color: 'var(--green)' }}>{Math.round(totalFi)}{t('nutrition.fiberShort')}</span>
          </div>
        )}
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
        <div className="collapse-content px-2 pb-2">
          {/* Meal note */}
          {onNoteChange && (
            <MealNoteInput note={note} onChange={onNoteChange} />
          )}

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
                accentColor={accentColor}
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
                accentColor={accentColor}
              />
            ))}
          </MealDropZone>

          {/* Add food dropdown */}
          {onFoodSelect && <FoodSearch onSelect={onFoodSelect} />}

          {/* Add recipe dropdown */}
          {onRecipeSelect && <RecipeSearch onSelect={onRecipeSelect} />}
        </div>
      </div>
    </div>
  );
}
