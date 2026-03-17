import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFood } from '@/api/foods';
import { showApiError, showSuccess } from '@/lib/api-errors';

interface AddFoodDialogProps {
  onCreated: () => void;
}

const addFoodSchema = z.object({
  name: z.string().min(2),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
  barcode: z.string().optional(),
});

type AddFoodForm = z.infer<typeof addFoodSchema>;

export default function AddFoodDialog({ onCreated }: AddFoodDialogProps) {
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
        barcode: data.barcode || null,
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
    <div className="mb-5 rounded-sm border border-gold-dim/30 bg-gold/5 p-5">
      <div className="mb-3 text-sm font-semibold">
        {t('foods.addFoodTitle')}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              {...register('name')}
              placeholder={t('foods.foodName')}
              className={`w-full ${inputClass} ${errors.name ? 'border-red-500/50' : ''}`}
            />
          </div>
          <div className="w-48">
            <input
              {...register('barcode')}
              placeholder={t('foods.barcode')}
              className={`w-full ${inputClass}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
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
