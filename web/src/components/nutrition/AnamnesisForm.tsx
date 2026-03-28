import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { ClientDashboard } from '@/api/nutrition-goals';

const schema = z.object({
  weightKg: z.number().min(30).max(300),
  heightCm: z.number().min(100).max(250),
  age: z.number().int().min(10).max(120),
  sex: z.enum(['Male', 'Female']),
  activityLevel: z.enum([
    'Sedentary',
    'LightlyActive',
    'ModeratelyActive',
    'VeryActive',
    'ExtremelyActive',
  ]),
  goal: z.enum(['Cut', 'Maintain', 'Bulk']),
});

export type AnamnesisData = z.infer<typeof schema>;

interface AnamnesisFormProps {
  client?: ClientDashboard | null;
  onSubmit: (data: AnamnesisData) => void;
  isLoading?: boolean;
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function AnamnesisForm({
  client,
  onSubmit,
  isLoading,
}: AnamnesisFormProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AnamnesisData>({
    resolver: zodResolver(schema),
    defaultValues: {
      weightKg: undefined,
      heightCm: undefined,
      age: undefined,
      sex: 'Male',
      activityLevel: 'ModeratelyActive',
      goal: 'Maintain',
    },
  });

  useEffect(() => {
    if (!client) return;
    const values: Partial<AnamnesisData> = {};
    if (client.weightKg) values.weightKg = client.weightKg;
    if (client.heightCm) values.heightCm = client.heightCm;
    if (client.dateOfBirth) values.age = calculateAge(client.dateOfBirth);
    const ob = client.onboarding;
    if (ob?.sex === 'Male' || ob?.sex === 'Female') values.sex = ob.sex;
    if (ob?.derivedActivityLevel && ['Sedentary', 'LightlyActive', 'ModeratelyActive', 'VeryActive', 'ExtremelyActive'].includes(ob.derivedActivityLevel)) {
      values.activityLevel = ob.derivedActivityLevel as AnamnesisData['activityLevel'];
    }
    if (ob?.derivedNutritionGoal && ['Cut', 'Maintain', 'Bulk'].includes(ob.derivedNutritionGoal)) {
      values.goal = ob.derivedNutritionGoal as AnamnesisData['goal'];
    }
    reset((prev) => ({ ...prev, ...values }));
  }, [client, reset]);

  const currentGoal = watch('goal');
  const currentSex = watch('sex');

  const inputClass =
    'w-full rounded-sm border border-border-md bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-border-hv';
  const errorClass = 'mt-1 text-xs text-red-400';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-accent">
        {t('nutritionGoals.anamnesis')}
      </h2>

      {/* Weight & Height */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="lbl">{t('nutritionGoals.weight')}</label>
          <input
            type="number"
            step="0.1"
            className={inputClass}
            {...register('weightKg')}
          />
          {errors.weightKg && (
            <p className={errorClass}>{t('validation.required')}</p>
          )}
        </div>
        <div>
          <label className="lbl">{t('nutritionGoals.height')}</label>
          <input
            type="number"
            step="0.1"
            className={inputClass}
            {...register('heightCm')}
          />
          {errors.heightCm && (
            <p className={errorClass}>{t('validation.required')}</p>
          )}
        </div>
      </div>

      {/* Age */}
      <div>
        <label className="lbl">{t('nutritionGoals.age')}</label>
        <input
          type="number"
          className={`${inputClass} max-w-[140px]`}
          {...register('age')}
        />
        {errors.age && (
          <p className={errorClass}>{t('validation.required')}</p>
        )}
      </div>

      {/* Sex */}
      <div>
        <label className="lbl">{t('nutritionGoals.sex')}</label>
        <div className="mt-1 flex gap-3">
          {(['Male', 'Female'] as const).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-2 rounded-sm border px-4 py-2 text-sm transition-colors ${
                currentSex === s
                  ? 'border-accent-br bg-accent-bg text-accent'
                  : 'border-border bg-bg2 text-text2 hover:border-accent-br'
              }`}
            >
              <input
                type="radio"
                value={s}
                className="sr-only"
                {...register('sex')}
              />
              {t(`nutritionGoals.${s.toLowerCase()}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Activity Level */}
      <div>
        <label className="lbl">{t('nutritionGoals.activityLevel')}</label>
        <select className={inputClass} {...register('activityLevel')}>
          <option value="Sedentary">{t('nutritionGoals.sedentary')}</option>
          <option value="LightlyActive">
            {t('nutritionGoals.lightlyActive')}
          </option>
          <option value="ModeratelyActive">
            {t('nutritionGoals.moderatelyActive')}
          </option>
          <option value="VeryActive">
            {t('nutritionGoals.veryActive')}
          </option>
          <option value="ExtremelyActive">
            {t('nutritionGoals.extremelyActive')}
          </option>
        </select>
      </div>

      {/* Goal */}
      <div>
        <label className="lbl">{t('nutritionGoals.goal')}</label>
        <div className="mt-1 flex gap-3">
          {(['Cut', 'Maintain', 'Bulk'] as const).map((g) => (
            <label
              key={g}
              className={`flex cursor-pointer items-center gap-2 rounded-sm border px-4 py-2 text-sm transition-colors ${
                currentGoal === g
                  ? 'border-accent-br bg-accent-bg text-accent'
                  : 'border-border bg-bg2 text-text2 hover:border-accent-br'
              }`}
            >
              <input
                type="radio"
                value={g}
                className="sr-only"
                {...register('goal')}
              />
              {t(`nutritionGoals.${g.toLowerCase()}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-sm bg-accent px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-bg transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {isLoading
          ? t('nutritionGoals.calculating')
          : t('nutritionGoals.calculate')}
      </button>
    </form>
  );
}
