import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { showSuccess } from '@/lib/api-errors';
import { resolveLocalizedName } from '@/lib/nutrition-helpers';
import type { NutritionPlanDetail } from '@/api/plan-types';

type ShoppingItem = { id: string; name: string; amount: number; unit: string };

interface ShoppingListDrawerProps {
  open: boolean;
  onClose: () => void;
  plan: NutritionPlanDetail;
  selectedWeek: number;
}

export function ShoppingListDrawer({ open, onClose, plan, selectedWeek }: ShoppingListDrawerProps) {
  const { t, i18n } = useTranslation();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [shoppingData, setShoppingData] = useState<{ firstHalf: ShoppingItem[]; secondHalf: ShoppingItem[] }>({ firstHalf: [], secondHalf: [] });
  const [shoppingLoading, setShoppingLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCheckedItems(new Set());
  }, [open]);

  useEffect(() => {
    if (!open || !plan) return;
    let cancelled = false;

    async function buildShoppingList() {
      setShoppingLoading(true);
      const week = plan.weeks.find(w => w.weekNumber === selectedWeek);
      if (!week) { setShoppingData({ firstHalf: [], secondHalf: [] }); setShoppingLoading(false); return; }

      // Collect all unique recipe IDs used in this week
      const recipeIds = new Set<string>();
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const recipe of (meal.recipes ?? [])) {
            recipeIds.add(recipe.recipeId);
          }
        }
      }

      // Fetch recipe details to get their ingredients
      const recipeMap = new Map<string, { foodExternalId: string; foodName: string; amountGrams: number }[]>();
      if (recipeIds.size > 0) {
        const { getRecipe } = await import('@/api/recipes');
        const results = await Promise.allSettled(
          Array.from(recipeIds).map(id => getRecipe(id))
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            recipeMap.set(r.value.recipeId, r.value.foods);
          }
        }
      }

      if (cancelled) return;

      function aggregateDays(days: NonNullable<typeof week>['days']) {
        const agg = new Map<string, { name: string; amount: number }>();
        for (const day of days) {
          for (const meal of day.meals) {
            // Direct foods
            for (const food of meal.foods) {
              const key = food.foodExternalId;
              const existing = agg.get(key);
              if (existing) existing.amount += food.amountGrams;
              else agg.set(key, { name: resolveLocalizedName(food, i18n.language), amount: food.amountGrams });
            }
            // Recipe ingredients (scaled by servings)
            for (const recipe of (meal.recipes ?? [])) {
              const ingredients = recipeMap.get(recipe.recipeId);
              if (!ingredients) continue;
              for (const ing of ingredients) {
                const key = ing.foodExternalId;
                const scaledAmount = ing.amountGrams * recipe.servings;
                const existing = agg.get(key);
                if (existing) existing.amount += scaledAmount;
                else agg.set(key, { name: ing.foodName, amount: scaledAmount });
              }
            }
          }
        }
        return Array.from(agg.entries()).map(([id, val]) => ({ id, name: val.name, amount: val.amount, unit: 'g' }));
      }

      const firstDays = week.days.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 4);
      const secondDays = week.days.filter(d => d.dayOfWeek >= 5 && d.dayOfWeek <= 7);

      setShoppingData({
        firstHalf: aggregateDays(firstDays),
        secondHalf: aggregateDays(secondDays),
      });
      setShoppingLoading(false);
    }

    buildShoppingList();
    return () => { cancelled = true; };
  }, [open, plan, selectedWeek, i18n.language]);

  if (!open) return null;

  const toggleCheck = (key: string) =>
    setCheckedItems(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const renderItems = (items: ShoppingItem[], suffix: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item) => {
        const key = suffix ? item.id + suffix : item.id;
        return (
          <label
            key={item.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.1s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
          >
            <input
              type="checkbox"
              checked={checkedItems.has(key)}
              onChange={() => toggleCheck(key)}
              style={{ accentColor: 'var(--green)' }}
            />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textDecoration: checkedItems.has(key) ? 'line-through' : undefined, opacity: checkedItems.has(key) ? 0.5 : 1 }}>
              {item.name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {Math.round(item.amount)} {item.unit}
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      {/* Drawer */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: 420, maxWidth: '90vw', height: '100vh',
          background: 'var(--bg)', borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
          animation: 'authStepIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>🛒 {t('nutrition.shoppingListWeek', { week: selectedWeek })}</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: 4, borderRadius: 'var(--radius)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {shoppingLoading && (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text3)' }}>{t('nutrition.loadingIngredients')}</div>
          )}
          {!shoppingLoading && <>
          {/* First half: Mon-Thu */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              {t('nutrition.monToThu')}
            </div>
            {shoppingData.firstHalf.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text4)', padding: '8px 0' }}>{t('nutrition.noItems')}</div>
            ) : renderItems(shoppingData.firstHalf, '')}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 16px' }} />

          {/* Second half: Fri-Sun */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              {t('nutrition.friToSun')}
            </div>
            {shoppingData.secondHalf.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text4)', padding: '8px 0' }}>{t('nutrition.noItems')}</div>
            ) : renderItems(shoppingData.secondHalf, '-2')}
          </div>
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              const format = (items: ShoppingItem[], suffix: string) =>
                items.map(item => {
                  const key = suffix ? item.id + suffix : item.id;
                  return `${checkedItems.has(key) ? '☑' : '☐'} ${item.name} – ${Math.round(item.amount)} ${item.unit}`;
                }).join('\n');
              const text = `${t('nutrition.monToThu').toUpperCase()}\n${format(shoppingData.firstHalf, '')}\n\n${t('nutrition.friToSun').toUpperCase()}\n${format(shoppingData.secondHalf, '-2')}`;
              navigator.clipboard.writeText(text);
              showSuccess(t('nutrition.shoppingList'));
            }}
          >
            📋 {t('nutrition.copy')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ShoppingListDrawer;
