import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';

interface AddFoodDialogProps {
  onCreated: () => void;
  onClose?: () => void;
}

const addFoodSchema = z.object({
  name: z.string().min(2),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
  nameEn: z.string().optional(),
  nameCs: z.string().optional(),
  nameDe: z.string().optional(),
});

type AddFoodForm = z.infer<typeof addFoodSchema>;

export default function AddFoodDialog({ onCreated, onClose }: AddFoodDialogProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddFoodForm>({
    resolver: zodResolver(addFoodSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: AddFoodForm) =>
      createFood({
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
        allergens: [],
        commonServings: [],
      }),
    onSuccess: () => {
      showSuccess('foods.created');
      reset();
      onCreated();
    },
    onError: (error) => {
      showApiError(error, 'foods.createError');
    },
  });

  const onSubmit = (data: AddFoodForm) => {
    mutation.mutate(data);
  };

  const inputClass =
    'rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-gold/40';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">{t('foods.addFoodTitle')}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-text3 transition-colors hover:text-text"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block font-heading text-xs text-text3">
              {t('foods.foodName')}
            </label>
            <input
              {...register('name')}
              placeholder={t('foods.foodName')}
              className={`w-full ${inputClass} ${errors.name ? 'border-red-500/50' : ''}`}
            />
          </div>

          {/* Localized names */}
          <div className="mt-1 border-t border-border pt-3">
            <label className="mb-2 block font-heading text-xs text-text3">
              {t('foods.localizedNames')}
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">EN</span>
                <input
                  {...register('nameEn')}
                  placeholder="English name"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">CS</span>
                <input
                  {...register('nameCs')}
                  placeholder="Český název"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-center text-[11px] font-semibold text-text3">DE</span>
                <input
                  {...register('nameDe')}
                  placeholder="Deutscher Name"
                  className={`w-full ${inputClass}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-heading text-xs text-text3">
              {t('foods.kcal')}
            </label>
            <input
              {...register('kcal')}
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={`w-full ${inputClass} ${errors.kcal ? 'border-red-500/50' : ''}`}
            />
          </div>
          <div>
            <label className="mb-1 block font-heading text-xs text-text3">
              {t('foods.protein')}
            </label>
            <input
              {...register('protein')}
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={`w-full ${inputClass} ${errors.protein ? 'border-red-500/50' : ''}`}
            />
          </div>
          <div>
            <label className="mb-1 block font-heading text-xs text-text3">
              {t('foods.carbs')}
            </label>
            <input
              {...register('carbs')}
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={`w-full ${inputClass} ${errors.carbs ? 'border-red-500/50' : ''}`}
            />
          </div>
          <div>
            <label className="mb-1 block font-heading text-xs text-text3">
              {t('foods.fat')}
            </label>
            <input
              {...register('fat')}
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={`w-full ${inputClass} ${errors.fat ? 'border-red-500/50' : ''}`}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-sm bg-gold px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {mutation.isPending ? t('common.saving') : t('foods.createFood')}
          </button>
        </div>

      </form>
    </div>
  );
}
