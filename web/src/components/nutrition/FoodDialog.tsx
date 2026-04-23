import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFood, updateFood, requestFoodImageUploadUrl, confirmFoodImage } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { FoodSummary, FoodCategory, FoodVisibility } from '@/api/food-types';
import { CATEGORY_CSS_COLORS, FOOD_CATEGORIES } from '@/components/nutrition/food-category';
import { INPUT_CLASS_SM, CANCEL_BUTTON_CLASS } from '@/lib/styles';
import { Toggle, ImagePicker, ImageLightbox } from '@/components/ui';


const foodSchema = z.object({
  name: z.string().min(2),
  category: z.string(),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
  fiber: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
  nameEn: z.string().optional(),
  nameCs: z.string().optional(),
  nameDe: z.string().optional(),
  visibility: z.enum(['Public', 'Private']).default('Public'),
});

type FoodFormInput = z.input<typeof foodSchema>;
type FoodForm = z.output<typeof foodSchema>;
type Mode = 'view' | 'edit';

interface FoodDialogProps {
  open: boolean;
  food?: FoodSummary | null;
  onClose: () => void;
  /** Called after a successful create or update. Receives the server's
   *  response so the parent can update any cached snapshot it holds
   *  (e.g. the `food` prop passed back in when re-entering edit mode). */
  onSaved: (updated: FoodSummary) => void;
}

export function FoodDialog({ open, food, onClose, onSaved }: FoodDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isNew = !food;
  const [mode, setMode] = useState<Mode>('view');
  const [transitioning, setTransitioning] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Track the committed image URL independently from the food prop so the hero
  // updates immediately after a successful upload without waiting for a refetch.
  const [committedImageUrl, setCommittedImageUrl] = useState<string | null>(
    food?.imageUrl ?? null,
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FoodFormInput, unknown, FoodForm>({
    resolver: zodResolver(foodSchema),
  });

  const visibility = watch('visibility') ?? 'Public';

  const populateForm = (f: FoodSummary) => {
    reset({
      name: f.rawName, category: f.category ?? 'Other',
      kcal: f.nutrientValue.kcal, protein: f.nutrientValue.protein,
      carbs: f.nutrientValue.carbs, fat: f.nutrientValue.fat,
      fiber: f.nutrientValue.fiber ?? 0, note: f.note ?? '',
      nameEn: f.nameEn ?? '', nameCs: f.nameCs ?? '', nameDe: f.nameDe ?? '',
      visibility: f.visibility ?? 'Public',
    });
  };

  useEffect(() => {
    if (!open) { setMode('view'); return; }
    if (isNew) {
      setMode('edit');
      setCommittedImageUrl(null);
      reset({ name: '', category: 'Other', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, note: '', nameEn: '', nameCs: '', nameDe: '', visibility: 'Public' });
    } else {
      setCommittedImageUrl(food?.imageUrl ?? null);
      setMode('view');
    }
  }, [open, food?.foodId, food?.imageUrl]); // food.imageUrl syncs committedImageUrl when the parent updates the food prop

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

  const switchMode = (to: Mode) => {
    setTransitioning(true);
    setTimeout(() => {
      if (to === 'edit' && food) populateForm(food);
      setMode(to);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setTimeout(() => setTransitioning(false), 20);
    }, 150);
  };

  const handleImageUploaded = async (blobUrl: string) => {
    if (!food?.foodId) return;
    try {
      await confirmFoodImage(food.foodId, blobUrl);
      setCommittedImageUrl(blobUrl);
      // Invalidate the foods list so the thumbnail updates on next render
      await queryClient.invalidateQueries({ queryKey: ['foods'] });
      showSuccess('foods.imageUpdated');
    } catch (err) {
      showApiError(err, 'foods.imageUpdateError');
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FoodForm) => {
      const payload = {
        name: data.name, nameEn: data.nameEn || null, nameCs: data.nameCs || null, nameDe: data.nameDe || null,
        nutrientValue: { kcal: data.kcal, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber ?? 0 },
        category: data.category as FoodCategory, note: data.note || null,
        allergens: food?.allergens ?? [], commonServings: food?.commonServings ?? [],
        visibility: (data.visibility ?? 'Public') as FoodVisibility,
      };
      return isNew ? createFood(payload) : updateFood(food!.foodId, payload);
    },
    onSuccess: (updated) => {
      showSuccess(isNew ? 'foods.created' : 'foods.updated');
      onSaved(updated);
      if (isNew) { onClose(); } else { setMode('view'); }
    },
    onError: (error) => showApiError(error, isNew ? 'foods.createError' : 'foods.updateError'),
  });

  if (!open) return null;

  const nv = food?.nutrientValue;
  const cat = food?.category ?? 'Other';
  const catColors = CATEGORY_CSS_COLORS[cat] ?? CATEGORY_CSS_COLORS.Other;

  const contentStyle: React.CSSProperties = {
    opacity: transitioning ? 0 : 1,
    transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
    transition: 'opacity .15s ease, transform .15s ease',
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: mode === 'edit' ? 560 : 500, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out', transition: 'width .3s ease' }}
        >
          {/* Hero */}
          <div className="flex items-center justify-center" style={{ height: mode === 'edit' ? 100 : 120, background: 'var(--bg3)', position: 'relative', transition: 'height .3s ease', overflow: 'hidden' }}>
            {committedImageUrl ? (
              <img
                src={committedImageUrl}
                alt={food?.name ?? t('foods.detail.image.empty')}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span style={{ fontSize: 40, opacity: 0.2 }}>📦</span>
            )}
            {committedImageUrl && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={t('imageLightbox.open')}
                title={t('imageLightbox.open')}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                </svg>
              </button>
            )}
            {mode === 'view' && food && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.4))', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 20px' }}>
                <div className="text-white" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{food.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ padding: '1px 6px', borderRadius: 3, background: catColors.bg, color: catColors.color, fontSize: 10, fontWeight: 500 }}>
                    {t(`foods.category${cat}`)}
                  </span>
                  <span>{t('foods.per100g')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            {mode === 'edit' ? (
              <input {...register('name')} placeholder={t('foods.foodNamePlaceholder')}
                className={`flex-1 text-[15px] font-semibold bg-transparent border-none outline-none text-text placeholder:text-text3 ${errors.name ? 'text-red' : ''}`} />
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{food?.name}</div>
                {food?.note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{food.note}</div>}
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }} aria-label="Close food dialog">✕</button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-3" style={{ minHeight: 0 }}>
            <div style={contentStyle}>

              {/* ── VIEW MODE ── */}
              {mode === 'view' && food && nv && (
                <>
                  {/* Macro strip */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'kcal', value: nv.kcal, color: 'var(--accent)' },
                      { label: t('foods.protein'), value: `${nv.protein}g`, color: 'var(--blue)' },
                      { label: t('foods.carbs'), value: `${nv.carbs}g`, color: 'var(--orange)' },
                      { label: t('foods.fat'), value: `${nv.fat}g`, color: 'var(--purple)' },
                      { label: t('foods.fiber'), value: `${nv.fiber ?? 0}g`, color: 'var(--green)' },
                    ].map((m) => (
                      <div key={m.label} style={{ flex: 1, textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 4px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Details */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, marginTop: 14 }}>
                    {t('foods.localizedNames')}
                  </div>
                  {[
                    { label: 'EN', value: food.nameEn },
                    { label: 'CS', value: food.nameCs },
                    { label: 'DE', value: food.nameDe },
                  ].map((l) => l.value && (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                      <span style={{ width: 24, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>{l.label}</span>
                      <span style={{ color: 'var(--text)' }}>{l.value}</span>
                    </div>
                  ))}

                  {food.note && (
                    <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-br)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                      <span>{food.note}</span>
                    </div>
                  )}

                  <div style={{ height: 16 }} />
                </>
              )}

              {/* ── EDIT MODE ── */}
              {mode === 'edit' && (
                <div className="flex flex-col gap-4">
                  {/* Category + visibility pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px]" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                      <span className="font-medium text-text3">{t('foods.category')}</span>
                      <select {...register('category')} className="bg-transparent border-none outline-none text-[12px] text-text" style={{ fontFamily: 'inherit' }}>
                        {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{t(`foods.category${c}`)}</option>)}
                      </select>
                    </div>
                    <div
                      className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px]"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
                      title={t('foods.visibilityHint')}
                    >
                      <span className="font-medium text-text3">
                        {visibility === 'Public' ? t('foods.visibilityPublic') : t('foods.visibilityPrivate')}
                      </span>
                      <Toggle
                        checked={visibility === 'Public'}
                        onChange={(c) => setValue('visibility', c ? 'Public' : 'Private', { shouldDirty: true })}
                      />
                    </div>
                  </div>

                  {/* Editable macros */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-text3">{t('foods.macrosPerHundred')}</label>
                    <div className="flex gap-1.5">
                      {[
                        { key: 'kcal' as const, label: 'kcal', color: 'var(--accent)', error: errors.kcal },
                        { key: 'protein' as const, label: `${t('nutrition.proteinShort')} (g)`, color: 'var(--blue)', error: errors.protein },
                        { key: 'carbs' as const, label: `${t('nutrition.carbsShort')} (g)`, color: 'var(--orange)', error: errors.carbs },
                        { key: 'fat' as const, label: `${t('nutrition.fatShort')} (g)`, color: 'var(--purple)', error: errors.fat },
                        { key: 'fiber' as const, label: `${t('nutrition.fiberShort')} (g)`, color: 'var(--green)', error: undefined },
                      ].map((m) => (
                        <div key={m.key} className="flex-1 text-center rounded-md" style={{ background: 'var(--bg2)', border: `1px solid ${m.error ? 'var(--red)' : 'var(--border)'}`, padding: '6px 4px' }}>
                          <input {...register(m.key)} type="number" min={0} step="any"
                            className="w-full text-center text-sm font-bold bg-transparent border-none outline-none"
                            style={{ color: m.color, letterSpacing: '-0.01em' }} />
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Localized names */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-text3">{t('foods.localizedNames')}</label>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { key: 'nameEn' as const, label: 'EN', placeholder: 'English name' },
                        { key: 'nameCs' as const, label: 'CS', placeholder: 'Český název' },
                        { key: 'nameDe' as const, label: 'DE', placeholder: 'Deutscher Name' },
                      ].map((l) => (
                        <div key={l.key} className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-text3 w-6 text-center shrink-0">{l.label}</span>
                          <input {...register(l.key)} placeholder={l.placeholder} className={INPUT_CLASS_SM} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text3">
                      {t('foods.note')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                    </label>
                    <textarea {...register('note')} placeholder={t('foods.notePlaceholder')} rows={2} className={`${INPUT_CLASS_SM} resize-vertical`} />
                  </div>

                  {/* Hero image — only shown when editing an existing food (not during create) */}
                  {!isNew && food && (
                    <div>
                      <label className="mb-2 block text-xs font-medium text-text3">
                        {t('foods.detail.image.heading')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                      </label>
                      <ImagePicker
                        mode="free"
                        initialPreviewUrl={committedImageUrl ?? undefined}
                        requestUploadUrl={({ contentType, sizeBytes }) =>
                          requestFoodImageUploadUrl(food.foodId, { contentType, sizeBytes })
                        }
                        onUploaded={handleImageUploaded}
                      />
                    </div>
                  )}

                  {mutation.isError && (
                    <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{t('common.error')}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
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
                    ✏ {t('foods.editFoodTitle')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>{t('common.cancel')}</button>
                  <button onClick={handleSubmit((data) => mutation.mutate(data))} disabled={mutation.isPending}
                    className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 text-white"
                    style={{ background: 'var(--accent)' }}>
                    {mutation.isPending ? t('common.saving') : isNew ? t('foods.createFood') : t('foods.saveChanges')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <ImageLightbox
        images={committedImageUrl ? [committedImageUrl] : []}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={food?.name}
      />
    </>
  );
}
