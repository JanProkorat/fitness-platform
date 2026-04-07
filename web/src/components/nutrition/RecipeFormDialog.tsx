import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecipe, createRecipe, updateRecipe } from '@/api/recipes';
import { searchFoods } from '@/api/foods';
import type { RecipeSummary, RecipeDetail } from '@/api/recipe-types';
import type { FoodSummary } from '@/api/food-types';
import { showApiError, showSuccess } from '@/lib/api-errors';

interface IngredientRow {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: { kcal: number; protein: number; carbs: number; fat: number; fiber?: number | null };
  pieces: number;
  servingWeightGrams: number;
  servingLabel: string;
}

interface RecipeFormDialogProps {
  open: boolean;
  recipe?: RecipeSummary | null;
  onClose: () => void;
  onSaved: () => void;
  onDiscard?: () => void;
}

export function RecipeFormDialog({ open, recipe, onClose, onSaved, onDiscard }: RecipeFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!recipe;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [steps, setSteps] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodSummary[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [foodInputFocused, setFoodInputFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  const reset = useCallback(() => {
    setName(''); setDescription(''); setPrepTime(''); setSteps([]); setIngredients([]);
    setFoodQuery(''); setFoodResults([]); setFoodInputFocused(false); setNote('');
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    if (recipe) {
      setLoading(true);
      getRecipe(recipe.recipeId).then((d: RecipeDetail) => {
        setName(d.name);
        setDescription(d.description ?? '');
        setPrepTime(d.prepTimeMinutes ?? '');
        setSteps(d.steps ?? []);
        setNote(d.note ?? '');
        setIngredients(d.foods.map((f) => ({
          foodExternalId: f.foodExternalId, foodName: f.foodName,
          nutrientValuePer100Grams: f.nutrientValuePer100Grams,
          pieces: 1, servingWeightGrams: f.amountGrams, servingLabel: `${f.amountGrams}g`,
        })));
      }).catch(() => onClose()).finally(() => setLoading(false));
    }
  }, [open, recipe]);

  const loadFoods = useCallback(async (q: string) => {
    setFoodSearchLoading(true);
    try { const r = await searchFoods({ q: q || undefined, pageSize: 15 }); setFoodResults(r.foods ?? []); }
    catch { setFoodResults([]); } finally { setFoodSearchLoading(false); }
  }, []);

  useEffect(() => { if (open && !loading) loadFoods(''); }, [open, loading]);
  useEffect(() => { const t = setTimeout(() => { if (open) loadFoods(foodQuery); }, 300); return () => clearTimeout(t); }, [foodQuery, open]);

  const addFood = (food: FoodSummary) => {
    const s = food.commonServings?.[0];
    setIngredients((p) => [...p, { foodExternalId: food.foodId, foodName: food.name, nutrientValuePer100Grams: food.nutrientValue, pieces: 1, servingWeightGrams: s?.weightGrams ?? 100, servingLabel: s?.label ?? '100g' }]);
  };
  const updatePieces = (i: number, v: number) => setIngredients((p) => p.map((r, j) => j === i ? { ...r, pieces: v } : r));
  const removeIngr = (i: number) => setIngredients((p) => p.filter((_, j) => j !== i));

  const addStep = () => setSteps((p) => [...p, '']);
  const updateStep = (i: number, v: string) => setSteps((p) => p.map((s, j) => j === i ? v : s));
  const removeStep = (i: number) => setSteps((p) => p.filter((_, j) => j !== i));

  const totals = ingredients.reduce((a, item) => {
    const r = (item.pieces * item.servingWeightGrams) / 100;
    return { kcal: a.kcal + item.nutrientValuePer100Grams.kcal * r, protein: a.protein + item.nutrientValuePer100Grams.protein * r, carbs: a.carbs + item.nutrientValuePer100Grams.carbs * r, fat: a.fat + item.nutrientValuePer100Grams.fat * r, fiber: a.fiber + (item.nutrientValuePer100Grams.fiber ?? 0) * r };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const handleSave = async () => {
    if (!name.trim() || ingredients.length === 0) return;
    setSaving(true);
    const payload = {
      name: name.trim(), description: description.trim() || undefined,
      prepTimeMinutes: prepTime || null,
      steps: steps.filter((s) => s.trim()).length > 0 ? steps.filter((s) => s.trim()) : null,
      note: note.trim() || null,
      foods: ingredients.map((i) => ({ foodExternalId: i.foodExternalId, amountGrams: i.pieces * i.servingWeightGrams })),
    };
    try {
      if (isEdit) { await updateRecipe(recipe!.recipeId, payload); showSuccess('recipes.updated'); }
      else { await createRecipe(payload); showSuccess('recipes.created'); }
      onSaved(); onClose();
    } catch (err) { showApiError(err, isEdit ? 'recipes.updateError' : 'recipes.createError'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  const inp = 'rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full';

  return (
    <>
      <style>{`
        @keyframes dlg-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dlg-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .6s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden" style={{ width: 680, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .6s ease-out' }}>

          {/* Hero */}
          <div className="flex items-center justify-center" style={{ height: 120, background: 'var(--bg3)', borderRadius: '10px 10px 0 0', position: 'relative' }}>
            <span style={{ fontSize: 44, opacity: 0.25 }}>🍽️</span>
          </div>

          {/* Header: name */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recipes.recipeNamePlaceholder')} className="flex-1 text-[15px] font-semibold bg-transparent border-none outline-none text-text placeholder:text-text3" />
            <button onClick={onClose} className="text-text3 hover:text-text transition-colors text-lg">✕</button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-3" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-text3">{t('common.loading')}</div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Meta pills */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px]" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <span className="font-medium text-text3">{t('recipes.prepTime')}</span>
                    <input type="number" min={1} value={prepTime} onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : '')} className="w-10 bg-transparent border-none outline-none text-[12px] text-text text-center" placeholder="—" />
                    <span className="text-text3">min</span>
                  </div>
                </div>

                {/* Description — simple small input */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">{t('recipes.description')}</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('recipes.descriptionPlaceholder')} className={inp} />
                </div>

                {/* Auto-calculated macros */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text3">{t('recipes.nutritionPerRecipe')}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text4)' }}>{t('recipes.autoCalculated')}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { label: 'kcal', value: Math.round(totals.kcal), color: 'var(--text)' },
                      { label: 'P', value: `${Math.round(totals.protein)}g`, color: 'var(--blue)' },
                      { label: 'C', value: `${Math.round(totals.carbs)}g`, color: 'var(--orange)' },
                      { label: 'F', value: `${Math.round(totals.fat)}g`, color: 'var(--purple)' },
                      { label: 'Fi', value: `${Math.round(totals.fiber)}g`, color: 'var(--green)' },
                    ].map((m) => (
                      <div key={m.label} className="flex-1 text-center py-1.5 rounded-md" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                        <div className="text-sm font-bold" style={{ color: m.color, letterSpacing: '-0.01em' }}>{m.value}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text3">{t('recipes.foods')}</label>
                  <div className="relative mb-2">
                    <input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} onFocus={() => setFoodInputFocused(true)} onBlur={() => setFoodInputFocused(false)} placeholder={t('nutrition.searchFoods')} className={`${inp} pl-8`} />
                    <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {foodInputFocused && foodResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-bg2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                        {foodResults.map((food) => {
                          const added = ingredients.some((i) => i.foodExternalId === food.foodId);
                          return (
                            <button key={food.foodId} type="button" disabled={added} onClick={() => addFood(food)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors ${added ? 'opacity-40' : 'hover:bg-bg-hover'}`}>
                              <span className="truncate font-medium">{food.name}</span>
                              <span className="ml-2 shrink-0 text-[11px] text-text3 tabular-nums">{Math.round(food.nutrientValue.kcal)} kcal</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {ingredients.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full border-collapse text-[13px]">
                        <thead>
                          <tr className="text-left text-[10px] font-medium uppercase tracking-wider text-text3">
                            <th className="px-2.5 py-1.5 border-b border-border" style={{ width: '40%' }}>{t('common.name')}</th>
                            <th className="px-2 py-1.5 border-b border-border w-14 text-center">{t('recipes.pieces')}</th>
                            <th className="px-2 py-1.5 border-b border-border" style={{ width: '18%' }}>{t('recipes.serving')}</th>
                            <th className="px-2 py-1.5 border-b border-border w-14 text-right">kcal</th>
                            <th className="px-2 py-1.5 border-b border-border w-12 text-right">P</th>
                            <th className="px-2 py-1.5 border-b border-border w-12 text-right">C</th>
                            <th className="px-2 py-1.5 border-b border-border w-12 text-right">F</th>
                            <th className="px-1 py-1.5 border-b border-border w-7"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingredients.map((item, idx) => { const g = item.pieces * item.servingWeightGrams; const r = g / 100; return (
                            <tr key={`${item.foodExternalId}-${idx}`} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                              <td className="px-2.5 py-1.5 truncate">{item.foodName}</td>
                              <td className="px-1 py-1"><input type="number" min={1} value={item.pieces} onChange={(e) => updatePieces(idx, Math.max(1, Number(e.target.value) || 1))} className="w-full rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv" /></td>
                              <td className="px-2 py-1.5 text-[11px] text-text3 truncate">{item.servingLabel}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(item.nutrientValuePer100Grams.kcal * r)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(item.nutrientValuePer100Grams.protein * r)}g</td>
                              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(item.nutrientValuePer100Grams.carbs * r)}g</td>
                              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(item.nutrientValuePer100Grams.fat * r)}g</td>
                              <td className="px-1 py-1.5 text-center"><button onClick={() => removeIngr(idx)} className="text-text4 hover:text-red transition-colors text-sm">✕</button></td>
                            </tr>
                          ); })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Preparation steps */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text3">{t('recipes.stepsLabel')}</label>
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 mb-1.5">
                      <div className="flex items-center justify-center shrink-0 mt-1.5" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>
                        {idx + 1}
                      </div>
                      <textarea
                        value={step}
                        onChange={(e) => updateStep(idx, e.target.value)}
                        placeholder={`${t('recipes.stepPlaceholder')} ${idx + 1}...`}
                        rows={1}
                        className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text outline-none resize-none transition-colors focus:border-border-hv"
                        style={{ minHeight: 36, lineHeight: 1.5 }}
                        onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                      />
                      <button onClick={() => removeStep(idx)} className="shrink-0 mt-1.5 text-text4 hover:text-red transition-colors text-sm" style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={addStep} className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[12px] transition-colors hover:bg-bg-hover" style={{ color: 'var(--text3)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {t('recipes.addStep')}
                  </button>
                </div>

                {/* Tip / note */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">
                    {t('recipes.note')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                  </label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('recipes.notePlaceholder')} rows={2} className={`${inp} resize-vertical`} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
              <div>
                {isEdit && onDiscard && (
                  <button onClick={onDiscard} className="px-4 py-2 rounded-md text-[13px] font-medium text-text3 hover:bg-bg-hover transition-colors">
                    ← {t('recipes.discardChanges')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-medium text-text3 hover:bg-bg-hover transition-colors">{t('common.cancel')}</button>
                <button onClick={handleSave} disabled={saving || !name.trim() || ingredients.length === 0} className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                  {saving ? t('common.saving') : isEdit ? t('common.save') : t('recipes.createRecipe')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
