import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecipe } from '@/api/recipes';
import type { RecipeSummary, RecipeDetail } from '@/api/recipe-types';

interface RecipeDetailDialogProps {
  open: boolean;
  recipe: RecipeSummary | null;
  onClose: () => void;
  onEdit: () => void;
}

export function RecipeDetailDialog({ open, recipe, onClose, onEdit }: RecipeDetailDialogProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !recipe) { setDetail(null); return; }
    setLoading(true);
    getRecipe(recipe.recipeId)
      .then(setDetail)
      .catch(() => onClose())
      .finally(() => setLoading(false));
  }, [open, recipe?.recipeId]);

  if (!open || !recipe) return null;

  const n = detail?.totalNutrients ?? recipe.totalNutrients;

  return (
    <>
      <style>{`
        @keyframes dlg-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dlg-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .6s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col shadow-2xl overflow-hidden"
          style={{ width: 600, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', animation: 'dlg-slide-up .6s ease-out' }}
        >
          {/* Hero */}
          <div style={{ height: 160, background: 'var(--bg3)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 48, opacity: 0.2 }}>🍽️</span>
            {/* Overlay gradient + name on hero */}
            {detail && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45))', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px 20px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{detail.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
                  {detail.foods.length} {t('recipes.foods').toLowerCase()}
                  {detail.prepTimeMinutes && ` · ${detail.prepTimeMinutes} min`}
                </div>
              </div>
            )}
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{recipe.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {recipe.foodCount} {t('recipes.foods').toLowerCase()}
                {recipe.prepTimeMinutes && ` · ${recipe.prepTimeMinutes} min`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 4px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text3)' }}>{t('common.loading')}</div>
            ) : detail && (
              <>
                {/* Description */}
                {detail.description && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                    {detail.description}
                  </div>
                )}

                {/* Macro strip */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'kcal', value: Math.round(n.kcal), color: 'var(--accent)' },
                    { label: t('foods.protein'), value: `${Math.round(n.protein)}g`, color: 'var(--blue)' },
                    { label: t('foods.carbs'), value: `${Math.round(n.carbs)}g`, color: 'var(--orange)' },
                    { label: t('foods.fat'), value: `${Math.round(n.fat)}g`, color: 'var(--purple)' },
                    { label: t('foods.fiber'), value: `${Math.round(n.fiber ?? 0)}g`, color: 'var(--green)' },
                  ].map((m) => (
                    <div key={m.label} style={{ flex: 1, textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 4px' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Ingredients */}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 14 }}>
                  {t('recipes.foods')}
                </div>
                {detail.foods.map((f, i) => {
                  const kcal = Math.round(f.nutrientValuePer100Grams.kcal * f.amountGrams / 100);
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: i < detail.foods.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{f.foodName}</span>
                      <span style={{ color: 'var(--text2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.amountGrams}g</span>
                      <span style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'right', minWidth: 52 }}>{kcal} kcal</span>
                    </div>
                  );
                })}

                {/* Steps */}
                {detail.steps && detail.steps.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 14 }}>
                      {t('recipes.stepsLabel')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            {i + 1}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{step}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Note */}
                {detail.note && (
                  <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-br)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                    <span>{detail.note}</span>
                  </div>
                )}

                <div style={{ height: 16 }} />
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text3)', cursor: 'pointer' }}
            >
              {t('common.close')}
            </button>
            <button
              onClick={onEdit}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer' }}
            >
              ✏ {t('recipes.editRecipe')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
