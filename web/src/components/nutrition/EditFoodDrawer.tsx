import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { updateFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';
import type { FoodSummary } from '@/api/food-types';

interface EditFoodDrawerProps {
  food: FoodSummary;
  onSaved: () => void;
  onClose: () => void;
}

const editFoodSchema = z.object({
  name: z.string().min(2),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
  note: z.string().optional(),
  nameEn: z.string().optional(),
  nameCs: z.string().optional(),
  nameDe: z.string().optional(),
});

type EditFoodForm = z.infer<typeof editFoodSchema>;

export default function EditFoodDrawer({ food, onSaved, onClose }: EditFoodDrawerProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFoodForm>({
    resolver: zodResolver(editFoodSchema),
    defaultValues: {
      name: food.rawName,
      kcal: food.nutrientValue.kcal,
      protein: food.nutrientValue.protein,
      carbs: food.nutrientValue.carbs,
      fat: food.nutrientValue.fat,
      note: food.note ?? '',
      nameEn: food.nameEn ?? '',
      nameCs: food.nameCs ?? '',
      nameDe: food.nameDe ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: food.rawName,
      kcal: food.nutrientValue.kcal,
      protein: food.nutrientValue.protein,
      carbs: food.nutrientValue.carbs,
      fat: food.nutrientValue.fat,
      note: food.note ?? '',
      nameEn: food.nameEn ?? '',
      nameCs: food.nameCs ?? '',
      nameDe: food.nameDe ?? '',
    });
  }, [food, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditFoodForm) =>
      updateFood(food.foodId, {
        name: data.name,
        nameEn: data.nameEn || null,
        nameCs: data.nameCs || null,
        nameDe: data.nameDe || null,
        nutrientValue: {
          kcal: data.kcal,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
        },
        note: data.note || null,
        allergens: food.allergens,
        commonServings: food.commonServings,
      }),
    onSuccess: () => {
      showSuccess('foods.updated');
      onSaved();
    },
    onError: (error) => {
      showApiError(error, 'foods.updateError');
    },
  });

  const inputClass =
    'rounded-sm border border-border-md bg-bg px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-border-hv';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">{t('foods.editFoodTitle')}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-text3 transition-colors hover:text-text"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text3">
            {t('foods.foodName')}
          </label>
          <input
            {...register('name')}
            className={`w-full ${inputClass} ${errors.name ? 'border-red-500/50' : ''}`}
          />
        </div>

        {/* Localized names */}
        <div className="border-t border-border pt-3">
          <label className="mb-2 block text-xs text-text3">
            {t('foods.localizedNames')}
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">EN</span>
              <input {...register('nameEn')} placeholder="English name" className={`w-full ${inputClass}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">CS</span>
              <input {...register('nameCs')} placeholder="Český název" className={`w-full ${inputClass}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">DE</span>
              <input {...register('nameDe')} placeholder="Deutscher Name" className={`w-full ${inputClass}`} />
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="border-t border-border pt-3">
          <label className="mb-2 block text-xs text-text3">
            {t('foods.macrosPerHundred')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text3">{t('foods.kcal')}</label>
              <input {...register('kcal')} type="number" min={0} step="any" className={`w-full ${inputClass} ${errors.kcal ? 'border-red-500/50' : ''}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text3">{t('foods.protein')}</label>
              <input {...register('protein')} type="number" min={0} step="any" className={`w-full ${inputClass} ${errors.protein ? 'border-red-500/50' : ''}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text3">{t('foods.carbs')}</label>
              <input {...register('carbs')} type="number" min={0} step="any" className={`w-full ${inputClass} ${errors.carbs ? 'border-red-500/50' : ''}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text3">{t('foods.fat')}</label>
              <input {...register('fat')} type="number" min={0} step="any" className={`w-full ${inputClass} ${errors.fat ? 'border-red-500/50' : ''}`} />
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="border-t border-border pt-3">
          <label className="mb-1 block text-xs text-text3">Poznámka</label>
          <textarea
            {...register('note')}
            placeholder="Volitelná poznámka k potravině..."
            rows={2}
            className={`w-full ${inputClass} resize-none`}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-2 w-full rounded-sm bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-bg transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {mutation.isPending ? t('common.saving') : t('foods.saveChanges')}
        </button>
      </form>
    </div>
  );
}
