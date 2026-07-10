import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecipe, createRecipe, updateRecipe } from '@/api/recipes';
import { searchFoods } from '@/api/foods';
import type { RecipeSummary, RecipeDetail, RecipeVisibility } from '@/api/recipe-types';
import type { FoodSummary } from '@/api/food-types';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { INPUT_CLASS_SM, CANCEL_BUTTON_CLASS } from '@/lib/styles';
import { Toggle, ImageLightbox } from '@/components/ui';
import { RecipeImageSection } from '@/components/nutrition/RecipeImageSection';

interface IngredientRow {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: { kcal: number; protein: number; carbs: number; fat: number; fiber?: number | null };
  amountGrams: number;
  note: string;
}

interface RecipeDialogProps {
  open: boolean;
  /** Pass a summary to view/edit; null for create mode (opens directly in edit). */
  recipe?: RecipeSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = 'view' | 'edit';

export function RecipeDialog({ open, recipe, onClose, onSaved }: RecipeDialogProps) {
  const { t } = useTranslation();
  const isNew = !recipe;

  const [mode, setMode] = useState<Mode>('view');
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);

  // Flat list of all viewable recipe images, main first then gallery entries.
  // Used both for the lightbox and for the index math when clicking a thumb.
  const allImages = detail?.imageUrl
    ? [detail.imageUrl, ...(detail.galleryImageUrls ?? [])]
    : (detail?.galleryImageUrls ?? []);

  const openLightboxAt = (i: number) => {
    setLightboxStart(i);
    setLightboxOpen(true);
  };

  // Edit form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [steps, setSteps] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<RecipeVisibility>('Public');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodSummary[]>([]);
  const [foodInputFocused, setFoodInputFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setName(''); setDescription(''); setPrepTime(''); setSteps([]); setNote('');
    setVisibility('Public');
    setIngredients([]); setFoodQuery(''); setFoodResults([]); setFoodInputFocused(false);
  }, []);

  // Load detail
  const loadDetail = useCallback(async (recipeId: string) => {
    setLoading(true);
    try {
      const d = await getRecipe(recipeId);
      setDetail(d);
      return d;
    } catch { onClose(); return null; }
    finally { setLoading(false); }
  }, [onClose]);

  useEffect(() => {
    if (!open) { setDetail(null); resetForm(); setMode('view'); return; }
    if (isNew) { setMode('edit'); resetForm(); }
    else { setMode('view'); loadDetail(recipe!.recipeId); }
  }, [open, recipe?.recipeId]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Populate form from detail
  const populateForm = (d: RecipeDetail) => {
    setName(d.name);
    setDescription(d.description ?? '');
    setPrepTime(d.prepTimeMinutes ?? '');
    setSteps(d.steps ?? []);
    setNote(d.note ?? '');
    setVisibility(d.visibility ?? 'Public');
    setIngredients(d.foods.map((f) => ({
      foodExternalId: f.foodExternalId, foodName: f.foodName,
      nutrientValuePer100Grams: f.nutrientValuePer100Grams,
      amountGrams: f.amountGrams,
      note: f.note ?? '',
    })));
  };

  const switchMode = (to: Mode) => {
    setTransitioning(true);
    setTimeout(() => {
      if (to === 'edit' && detail) populateForm(detail);
      setMode(to);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setTimeout(() => setTransitioning(false), 20);
    }, 150);
  };

  // Food search
  const loadFoods = useCallback(async (q: string) => {
    try { const r = await searchFoods({ q: q || undefined, pageSize: 15 }); setFoodResults(r.foods ?? []); }
    catch { setFoodResults([]); }
  }, []);

  useEffect(() => { if (open && mode === 'edit' && !loading) loadFoods(''); }, [open, mode, loading]);
  useEffect(() => { const timer = setTimeout(() => { if (open && mode === 'edit') loadFoods(foodQuery); }, 300); return () => clearTimeout(timer); }, [foodQuery, open, mode]);

  const addFood = (food: FoodSummary) => {
    const s = food.commonServings?.[0];
    setIngredients((p) => [...p, { foodExternalId: food.foodId, foodName: food.name, nutrientValuePer100Grams: food.nutrientValue, amountGrams: s?.weightGrams ?? 100, note: '' }]);
  };
  const updateAmountGrams = (i: number, v: number) => setIngredients((p) => p.map((r, j) => j === i ? { ...r, amountGrams: v } : r));
  const updateIngredientNote = (i: number, v: string) => setIngredients((p) => p.map((r, j) => j === i ? { ...r, note: v } : r));
  const removeIngr = (i: number) => setIngredients((p) => p.filter((_, j) => j !== i));
  const addStep = () => setSteps((p) => [...p, '']);
  const updateStep = (i: number, v: string) => setSteps((p) => p.map((s, j) => j === i ? v : s));
  const removeStep = (i: number) => setSteps((p) => p.filter((_, j) => j !== i));

  const totals = ingredients.reduce((a, item) => {
    const r = item.amountGrams / 100;
    return { kcal: a.kcal + item.nutrientValuePer100Grams.kcal * r, protein: a.protein + item.nutrientValuePer100Grams.protein * r, carbs: a.carbs + item.nutrientValuePer100Grams.carbs * r, fat: a.fat + item.nutrientValuePer100Grams.fat * r, fiber: a.fiber + (item.nutrientValuePer100Grams.fiber ?? 0) * r };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  // Reload detail after an image upload so hero + gallery reflect the new
  // blob URL. TS allows a () => void function to satisfy the callback's
  // (slot: RecipeImageSlot) => void shape, so we can drop the unused param
  // entirely rather than dance around no-unused-vars.
  const handleImageUploaded = useCallback(() => {
    if (recipe) loadDetail(recipe.recipeId);
  }, [recipe, loadDetail]);

  const handleSave = async () => {
    if (!name.trim() || ingredients.length === 0) return;
    setSaving(true);
    const payload = {
      name: name.trim(), description: description.trim() || undefined,
      prepTimeMinutes: prepTime || null,
      steps: steps.filter((s) => s.trim()).length > 0 ? steps.filter((s) => s.trim()) : null,
      note: note.trim() || null,
      foods: ingredients.map((i) => ({ foodExternalId: i.foodExternalId, amountGrams: i.amountGrams, note: i.note.trim() || null })),
      visibility,
    };
    try {
      if (!isNew) { await updateRecipe(recipe!.recipeId, payload); showSuccess('recipes.updated'); }
      else { await createRecipe(payload); showSuccess('recipes.created'); }
      onSaved();
      if (!isNew) {
        // Reload detail and switch back to view
        const d = await loadDetail(recipe!.recipeId);
        if (d) { setDetail(d); setMode('view'); }
      } else { onClose(); }
    } catch (err) { showApiError(err, !isNew ? 'recipes.updateError' : 'recipes.createError'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  const n = mode === 'view'
    ? (detail?.totalNutrients ?? recipe?.totalNutrients ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
    : totals;

  const contentStyle: React.CSSProperties = {
    opacity: transitioning ? 0 : 1,
    transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
    transition: 'opacity .15s ease, transform .15s ease',
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[2vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: mode === 'edit' ? 680 : 600, maxWidth: '95vw', maxHeight: '96vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out', transition: 'width .3s ease' }}
        >
          {/* Hero */}
          <div className="flex items-center justify-center" style={{ height: mode === 'edit' ? 120 : 160, background: 'var(--bg3)', position: 'relative', transition: 'height .3s ease', overflow: 'hidden' }}>
            {mode === 'view' && detail?.imageUrl ? (
              <img
                src={detail.imageUrl}
                alt={detail.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span style={{ fontSize: 48, opacity: 0.2 }}>🍽️</span>
            )}
            {mode === 'view' && detail?.imageUrl && (
              <button
                type="button"
                onClick={() => openLightboxAt(0)}
                aria-label={t('imageLightbox.open')}
                title={t('imageLightbox.open')}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                </svg>
              </button>
            )}
            {mode === 'view' && detail && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45))', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px 20px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--overlay-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{detail.name}</div>
                <div style={{ fontSize: 13, color: 'var(--overlay-text-soft)', marginTop: 3 }}>
                  {detail.foods.length} {t('recipes.foods').toLowerCase()}
                  {detail.prepTimeMinutes && ` · ${detail.prepTimeMinutes} min`}
                </div>
              </div>
            )}
          </div>

          {/* Gallery strip — view mode only, shown when there are gallery images */}
          {mode === 'view' && detail && (detail.galleryImageUrls?.length ?? 0) > 0 && (
            <div className="flex gap-2 overflow-x-auto px-5 py-2" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {detail.galleryImageUrls!.map((url, i) => {
                // allImages = [main, ...gallery]; if there's a main image, gallery index i
                // maps to allImages[i+1]. If no main, gallery maps to allImages[i].
                const lightboxIndex = detail.imageUrl ? i + 1 : i;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => openLightboxAt(lightboxIndex)}
                    aria-label={`${t('recipes.image.galleryHeading')} ${i + 1} · ${t('imageLightbox.open')}`}
                    className="relative overflow-hidden rounded-md cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    style={{ width: 56, height: 56, flexShrink: 0, background: 'var(--bg3)' }}
                  >
                    <img src={url} alt={`${t('recipes.image.galleryHeading')} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            {mode === 'edit' ? (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recipes.recipeNamePlaceholder')} className="flex-1 text-[15px] font-semibold bg-transparent border-none outline-none text-text placeholder:text-text3" />
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{recipe?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {recipe?.foodCount} {t('recipes.foods').toLowerCase()}
                  {recipe?.prepTimeMinutes && ` · ${recipe.prepTimeMinutes} min`}
                </div>
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }} aria-label="Close recipe dialog">✕</button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-3" style={{ minHeight: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text3)' }}>{t('common.loading')}</div>
            ) : (
              <div style={contentStyle}>
                {mode === 'view' && detail && (
                  <>
                    {/* Description */}
                    {detail.description && (
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>{detail.description}</div>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 14 }}>{t('recipes.foods')}</div>
                    {detail.foods.map((f, i) => {
                      const kcal = Math.round(f.nutrientValuePer100Grams.kcal * f.amountGrams / 100);
                      return (
                        <div key={i} style={{ padding: '5px 0', borderBottom: i < detail.foods.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                            <span style={{ color: 'var(--text)' }}>{f.foodName}</span>
                            <span style={{ color: 'var(--text2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.amountGrams}g</span>
                            <span style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'right', minWidth: 52 }}>{kcal} kcal</span>
                          </div>
                          {f.note && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, paddingLeft: 2, fontStyle: 'italic' }}>{f.note}</div>
                          )}
                        </div>
                      );
                    })}

                    {/* Steps */}
                    {detail.steps && detail.steps.length > 0 && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 14 }}>{t('recipes.stepsLabel')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {detail.steps.map((step, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
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

                {mode === 'edit' && (
                  <div className="flex flex-col gap-4">
                    {/* Meta pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px]" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                        <span className="font-medium text-text3">{t('recipes.prepTime')}</span>
                        <input type="number" min={1} value={prepTime} onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : '')} className="w-10 bg-transparent border-none outline-none text-[12px] text-text text-center" placeholder="—" />
                        <span className="text-text3">min</span>
                      </div>
                      <div
                        className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px]"
                        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
                        title={t('recipes.visibilityHint')}
                      >
                        <span className="font-medium text-text3">
                          {visibility === 'Public' ? t('recipes.visibilityPublic') : t('recipes.visibilityPrivate')}
                        </span>
                        <Toggle
                          checked={visibility === 'Public'}
                          onChange={(c) => setVisibility(c ? 'Public' : 'Private')}
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text3">{t('recipes.description')}</label>
                      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('recipes.descriptionPlaceholder')} className={INPUT_CLASS_SM} />
                    </div>

                    {/* Auto-calculated macros */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text3">{t('recipes.nutritionPerRecipe')}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text4)' }}>{t('recipes.autoCalculated')}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[
                          { label: 'kcal', value: Math.round(totals.kcal), color: 'var(--accent)' },
                          { label: t('nutrition.proteinShort'), value: `${Math.round(totals.protein)}g`, color: 'var(--blue)' },
                          { label: t('nutrition.carbsShort'), value: `${Math.round(totals.carbs)}g`, color: 'var(--orange)' },
                          { label: t('nutrition.fatShort'), value: `${Math.round(totals.fat)}g`, color: 'var(--purple)' },
                          { label: t('nutrition.fiberShort'), value: `${Math.round(totals.fiber)}g`, color: 'var(--green)' },
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
                        <input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} onFocus={() => setFoodInputFocused(true)} onBlur={() => setFoodInputFocused(false)} placeholder={t('nutrition.searchFoods')} className={`${INPUT_CLASS_SM} pl-8`} />
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
                                <th className="px-2 py-1.5 border-b border-border w-20 text-center">g</th>
                                <th className="px-2 py-1.5 border-b border-border w-14 text-right">kcal</th>
                                <th className="px-2 py-1.5 border-b border-border w-12 text-right">{t('nutrition.proteinShort')}</th>
                                <th className="px-2 py-1.5 border-b border-border w-12 text-right">{t('nutrition.carbsShort')}</th>
                                <th className="px-2 py-1.5 border-b border-border w-12 text-right">{t('nutrition.fatShort')}</th>
                                <th className="px-2 py-1.5 border-b border-border w-12 text-right">{t('nutrition.fiberShort')}</th>
                                <th className="px-1 py-1.5 border-b border-border w-7"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {ingredients.map((item, idx) => { const r = item.amountGrams / 100; return (
                                <tr key={`${item.foodExternalId}-${idx}`} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors group">
                                  <td className="px-2.5 py-1.5 truncate">{item.foodName}</td>
                                  <td className="px-1 py-1"><input type="number" min={1} step={1} value={item.amountGrams} onChange={(e) => updateAmountGrams(idx, Math.max(1, Number(e.target.value) || 1))} className="w-full rounded border border-border bg-bg px-1.5 py-0.5 text-center text-[13px] text-text outline-none focus:border-border-hv" /></td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(item.nutrientValuePer100Grams.kcal * r)}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--blue)' }}>{Math.round(item.nutrientValuePer100Grams.protein * r)}g</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--orange)' }}>{Math.round(item.nutrientValuePer100Grams.carbs * r)}g</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--purple)' }}>{Math.round(item.nutrientValuePer100Grams.fat * r)}g</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--green)' }}>{Math.round((item.nutrientValuePer100Grams.fiber ?? 0) * r)}g</td>
                                  <td className="px-1 py-1.5 text-center"><button onClick={() => removeIngr(idx)} className="text-text4 hover:text-red transition-colors text-sm">✕</button></td>
                                </tr>
                              ); }).flatMap((row, idx) => [row, (
                                <tr key={`note-${ingredients[idx].foodExternalId}-${idx}`} className="border-b border-border last:border-0">
                                  <td colSpan={8} className="px-2.5 pb-1.5 pt-0">
                                    <input
                                      value={ingredients[idx].note}
                                      onChange={(e) => updateIngredientNote(idx, e.target.value)}
                                      placeholder={t('recipes.ingredientNotePlaceholder')}
                                      className="w-full bg-transparent border-none outline-none text-[11px] text-text3 placeholder:text-text4"
                                      style={{ lineHeight: 1.4 }}
                                    />
                                  </td>
                                </tr>
                              )])}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Steps */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text3">{t('recipes.stepsLabel')}</label>
                      {steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 mb-1.5">
                          <div className="flex items-center justify-center shrink-0 mt-1.5" style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>{idx + 1}</div>
                          <textarea value={step} onChange={(e) => updateStep(idx, e.target.value)} placeholder={`${t('recipes.stepPlaceholder')} ${idx + 1}...`} rows={1} className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text outline-none resize-none transition-colors focus:border-border-hv" style={{ minHeight: 36, lineHeight: 1.5 }} onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }} />
                          <button onClick={() => removeStep(idx)} className="shrink-0 mt-1.5 text-text4 hover:text-red transition-colors text-sm" style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={addStep} className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[12px] transition-colors hover:bg-bg-hover" style={{ color: 'var(--text3)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        {t('recipes.addStep')}
                      </button>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text3">
                        {t('recipes.note')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                      </label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('recipes.notePlaceholder')} rows={2} className={`${INPUT_CLASS_SM} resize-vertical`} />
                    </div>

                    {/* Images — only for existing saved recipes (need a recipeId) */}
                    {!isNew && recipe && detail && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <RecipeImageSection
                          recipeId={recipe.recipeId}
                          imageUrl={detail.imageUrl}
                          galleryImageUrls={detail.galleryImageUrls}
                          isOwner={detail.isOwnedByCurrentUser ?? true}
                          onUploaded={handleImageUploaded}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
              {mode === 'edit' && !isNew ? (
                <button onClick={() => switchMode('view')} className={CANCEL_BUTTON_CLASS}>
                  ← {t('recipes.discardChanges')}
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                {mode === 'view' ? (
                  <>
                    <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>{t('common.close')}</button>
                    <button onClick={() => switchMode('edit')} className="px-4 py-2 rounded-md text-[13px] font-medium transition-colors text-white" style={{ background: 'var(--accent)' }}>
                      ✏ {t('recipes.editRecipe')}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>{t('common.cancel')}</button>
                    <button onClick={handleSave} disabled={saving || !name.trim() || ingredients.length === 0} className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 text-white" style={{ background: 'var(--accent)' }}>
                      {saving ? t('common.saving') : isNew ? t('recipes.createRecipe') : t('common.save')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ImageLightbox
        images={allImages}
        startIndex={lightboxStart}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={detail?.name}
      />
    </>
  );
}
