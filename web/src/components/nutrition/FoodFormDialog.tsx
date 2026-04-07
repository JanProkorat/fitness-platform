import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFood, updateFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { FoodSummary, FoodCategory } from '@/api/food-types';

const FOOD_CATEGORIES: FoodCategory[] = [
  'Other', 'Fruit', 'Vegetables', 'Meat', 'FishAndSeafood', 'Dairy',
  'GrainsAndCereals', 'Legumes', 'NutsAndSeeds', 'OilsAndFats',
  'SweetsAndSnacks', 'Beverages', 'Supplements',
];

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
});

type FoodForm = z.infer<typeof foodSchema>;

interface FoodFormDialogProps {
  open: boolean;
  food?: FoodSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FoodFormDialog({ open, food, onClose, onSaved }: FoodFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!food;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FoodForm>({
    resolver: zodResolver(foodSchema),
  });

  useEffect(() => {
    if (open) {
      reset(food ? {
        name: food.rawName,
        category: food.category ?? 'Other',
        kcal: food.nutrientValue.kcal,
        protein: food.nutrientValue.protein,
        carbs: food.nutrientValue.carbs,
        fat: food.nutrientValue.fat,
        fiber: food.nutrientValue.fiber ?? 0,
        note: food.note ?? '',
        nameEn: food.nameEn ?? '',
        nameCs: food.nameCs ?? '',
        nameDe: food.nameDe ?? '',
      } : {
        name: '', category: 'Other', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
        note: '', nameEn: '', nameCs: '', nameDe: '',
      });
    }
  }, [open, food, reset]);

  const mutation = useMutation({
    mutationFn: (data: FoodForm) => {
      const payload = {
        name: data.name,
        nameEn: data.nameEn || null,
        nameCs: data.nameCs || null,
        nameDe: data.nameDe || null,
        nutrientValue: {
          kcal: data.kcal, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber ?? 0,
        },
        category: data.category as FoodCategory,
        note: data.note || null,
        allergens: food?.allergens ?? [],
        commonServings: food?.commonServings ?? [],
      };
      return isEdit ? updateFood(food!.foodId, payload) : createFood(payload);
    },
    onSuccess: () => {
      showSuccess(isEdit ? 'foods.updated' : 'foods.created');
      onSaved();
      onClose();
    },
    onError: (error) => showApiError(error, isEdit ? 'foods.updateError' : 'foods.createError'),
  });

  if (!open) return null;

  const inp = 'rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full';

  return (
    <>
      <style>{`
        @keyframes dlg-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dlg-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 560, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          {/* Hero */}
          <div className="flex items-center justify-center" style={{ height: 100, background: 'var(--bg3)', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>📦</span>
          </div>

          {/* Header: name input */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <input
              {...register('name')}
              placeholder={t('foods.foodNamePlaceholder')}
              className={`flex-1 text-[15px] font-semibold bg-transparent border-none outline-none text-text placeholder:text-text3 ${errors.name ? 'text-red' : ''}`}
            />
            <button onClick={onClose} className="text-text3 hover:text-text transition-colors text-lg">✕</button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-3" style={{ minHeight: 0 }}>
            <div className="flex flex-col gap-4">
              {/* Meta pills: category */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px]" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <span className="font-medium text-text3">{t('foods.category')}</span>
                  <select {...register('category')} className="bg-transparent border-none outline-none text-[12px] text-text" style={{ fontFamily: 'inherit' }}>
                    {FOOD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{t(`foods.category${cat}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Macros per 100g */}
              <div>
                <label className="mb-2 block text-xs font-medium text-text3">{t('foods.macrosPerHundred')}</label>
                <div className="flex gap-1.5">
                  {[
                    { key: 'kcal' as const, label: 'kcal', color: 'var(--accent)', error: errors.kcal },
                    { key: 'protein' as const, label: 'P (g)', color: 'var(--blue)', error: errors.protein },
                    { key: 'carbs' as const, label: 'C (g)', color: 'var(--orange)', error: errors.carbs },
                    { key: 'fat' as const, label: 'F (g)', color: 'var(--purple)', error: errors.fat },
                    { key: 'fiber' as const, label: 'Fi (g)', color: 'var(--green)', error: undefined },
                  ].map((m) => (
                    <div key={m.key} className="flex-1 text-center rounded-md" style={{ background: 'var(--bg2)', border: `1px solid ${m.error ? 'var(--red)' : 'var(--border)'}`, padding: '6px 4px' }}>
                      <input
                        {...register(m.key)}
                        type="number"
                        min={0}
                        step="any"
                        className="w-full text-center text-sm font-bold bg-transparent border-none outline-none"
                        style={{ color: m.color, letterSpacing: '-0.01em' }}
                      />
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
                      <input {...register(l.key)} placeholder={l.placeholder} className={inp} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">
                  {t('foods.note')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                </label>
                <textarea {...register('note')} placeholder={t('foods.notePlaceholder')} rows={2} className={`${inp} resize-vertical`} />
              </div>

              {mutation.isError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{t('common.error')}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-medium text-text3 hover:bg-bg-hover transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit((data) => mutation.mutate(data))}
              disabled={mutation.isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mutation.isPending ? t('common.saving') : isEdit ? t('foods.saveChanges') : t('foods.createFood')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
