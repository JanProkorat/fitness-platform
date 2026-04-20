import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Toggle, Select, Dialog } from '@/components/ui';
import { useToastStore } from '@/stores/toast';
import {
  upsertCheckInOverride,
  deleteCheckInOverride,
  DAY_OF_WEEK_KEYS,
  ORDERED_DAYS,
  formatTimeDisplay,
  toTimeSpanString,
} from '@/api/weekly-checkins';
import type {
  DayOfWeekInt,
  CheckInSettingDto,
  CheckInOverrideDto,
} from '@/api/weekly-checkins';

/* ─────────────────────── Constants ─────────────────────── */

/** Hour options from 06:00 to 22:00, rendered as "HH:mm". */
const HOUR_OPTIONS: string[] = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${String(h).padStart(2, '0')}:00`;
});

const DEFAULT_DAY: DayOfWeekInt = 1;
const DEFAULT_HOUR = '09:00';

/* ─────────────────────── Zod schema ─────────────────────── */

const dayOfWeekSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6),
]);

const overrideSchema = z.object({
  useDefaultDay: z.boolean(),
  dayOfWeek: dayOfWeekSchema.nullable(),
  useDefaultTime: z.boolean(),
  timeOfDay: z.string().nullable(),
  useDefaultEnabled: z.boolean(),
  enabled: z.boolean().nullable(),
  useDefaultAddendum: z.boolean(),
  addendum: z.string().max(200, 'Max 200 characters').nullable(),
});
type OverrideForm = z.infer<typeof overrideSchema>;

/* ─────────────────────── Helper ─────────────────────── */

/**
 * Derives effective values for an override by merging it with the trainer's
 * default setting for the same profession. Null fields inherit from setting.
 */
function resolveEffective(
  override: CheckInOverrideDto,
  settings: CheckInSettingDto[],
): {
  effectiveDayOfWeek: DayOfWeekInt;
  effectiveTimeDisplay: string;
} {
  const setting = settings.find((s) => s.profession === override.profession);
  const effectiveDayOfWeek: DayOfWeekInt =
    override.dayOfWeek !== null ? override.dayOfWeek : (setting?.dayOfWeek ?? DEFAULT_DAY);
  const effectiveTimeDisplay =
    override.timeOfDay !== null
      ? formatTimeDisplay(override.timeOfDay)
      : setting
        ? formatTimeDisplay(setting.timeOfDay)
        : DEFAULT_HOUR;
  return { effectiveDayOfWeek, effectiveTimeDisplay };
}

/* ─────────────────────── Component ─────────────────────── */

export interface OverrideDialogProps {
  override: CheckInOverrideDto;
  settings: CheckInSettingDto[];
  onClose: () => void;
}

/**
 * Dialog for editing (or reverting) a per-client weekly check-in override.
 * Extracted from WeeklyCheckInTab so it can be reused from the client detail page.
 */
export function OverrideDialog({ override, settings, onClose }: OverrideDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { effectiveDayOfWeek, effectiveTimeDisplay } = resolveEffective(override, settings);

  const defaultValues: OverrideForm = {
    useDefaultDay: override.dayOfWeek === null,
    dayOfWeek: override.dayOfWeek !== null ? override.dayOfWeek : effectiveDayOfWeek,
    useDefaultTime: override.timeOfDay === null,
    timeOfDay:
      override.timeOfDay !== null
        ? formatTimeDisplay(override.timeOfDay)
        : effectiveTimeDisplay,
    useDefaultEnabled: override.enabled === null,
    enabled: override.enabled,
    useDefaultAddendum: override.addendum === null,
    addendum: override.addendum ?? null,
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues,
  });

  const useDefaultDay = watch('useDefaultDay');
  const useDefaultTime = watch('useDefaultTime');
  const useDefaultEnabled = watch('useDefaultEnabled');
  const useDefaultAddendum = watch('useDefaultAddendum');
  const addendum = watch('addendum') ?? '';

  const deleteMutation = useMutation({
    mutationFn: () => deleteCheckInOverride(override.clientUserId, override.profession),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weekly-checkin-overrides'] });
      addToast(t('weeklyCheckIn.config.overrideDeleted'), 'success');
      onClose();
    },
    onError: () => {
      addToast(t('weeklyCheckIn.config.saveError'), 'error');
    },
  });

  const onSubmit = async (data: OverrideForm) => {
    const allDefault =
      data.useDefaultDay && data.useDefaultTime && data.useDefaultEnabled && data.useDefaultAddendum;

    if (allDefault) {
      deleteMutation.mutate();
      return;
    }

    try {
      await upsertCheckInOverride(override.clientUserId, override.profession, {
        dayOfWeek: data.useDefaultDay ? null : (data.dayOfWeek ?? null),
        timeOfDay: data.useDefaultTime
          ? null
          : (data.timeOfDay ? toTimeSpanString(data.timeOfDay) : null),
        enabled: data.useDefaultEnabled ? null : (data.enabled ?? null),
        addendum: data.useDefaultAddendum ? null : (data.addendum || null),
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-checkin-overrides'] });
      addToast(t('weeklyCheckIn.config.overrideSaved'), 'success');
      onClose();
    } catch {
      addToast(t('weeklyCheckIn.config.saveError'), 'error');
    }
  };

  const clientName = override.clientFirstName || override.clientLastName
    ? `${override.clientFirstName} ${override.clientLastName}`.trim()
    : override.clientUserId;
  const professionLabel =
    override.profession === 'Training'
      ? t('weeklyCheckIn.professionTraining')
      : t('weeklyCheckIn.professionNutrition');

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${clientName} — ${professionLabel}`}
      maxWidth={500}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || deleteMutation.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting || deleteMutation.isPending
              ? t('common.saving')
              : t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Enabled */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-text">{t('weeklyCheckIn.config.enabled')}</span>
            <Controller
              name="useDefaultEnabled"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-1.5 text-[12px] text-text2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="cursor-pointer"
                  />
                  {t('weeklyCheckIn.config.useDefault')}
                </label>
              )}
            />
          </div>
          {!useDefaultEnabled && (
            <Controller
              name="enabled"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value ?? false}
                  onChange={field.onChange}
                />
              )}
            />
          )}
        </div>

        {/* Day of week */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text2">
              {t('weeklyCheckIn.config.dayOfWeek')}
            </label>
            <Controller
              name="useDefaultDay"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-1.5 text-[12px] text-text2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="cursor-pointer"
                  />
                  {t('weeklyCheckIn.config.useDefault')}
                </label>
              )}
            />
          </div>
          {!useDefaultDay && (
            <Controller
              name="dayOfWeek"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value !== null ? String(field.value) : ''}
                  onChange={(e) => field.onChange(Number(e.target.value) as DayOfWeekInt)}
                >
                  {ORDERED_DAYS.map((day) => (
                    <option key={day} value={String(day)}>
                      {t(`weeklyCheckIn.day.${DAY_OF_WEEK_KEYS[day]}`)}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
          {!useDefaultDay && errors.dayOfWeek && (
            <p className="text-[11px] text-red mt-1">{errors.dayOfWeek.message}</p>
          )}
        </div>

        {/* Time */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text2">
              {t('weeklyCheckIn.config.time')}
            </label>
            <Controller
              name="useDefaultTime"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-1.5 text-[12px] text-text2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="cursor-pointer"
                  />
                  {t('weeklyCheckIn.config.useDefault')}
                </label>
              )}
            />
          </div>
          {!useDefaultTime && (
            <Controller
              name="timeOfDay"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
        </div>

        {/* Addendum */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text2">
              {t('weeklyCheckIn.config.addendum')}
            </label>
            <div className="flex items-center gap-3">
              {!useDefaultAddendum && (
                <span className="text-[11px] text-text3">{addendum.length}/200</span>
              )}
              <Controller
                name="useDefaultAddendum"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-1.5 text-[12px] text-text2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="cursor-pointer"
                    />
                    {t('weeklyCheckIn.config.useDefault')}
                  </label>
                )}
              />
            </div>
          </div>
          {!useDefaultAddendum && (
            <textarea
              {...register('addendum')}
              rows={3}
              maxLength={200}
              className="w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] resize-vertical focus:outline-none focus:border-border-hv transition-colors"
              placeholder={t('weeklyCheckIn.config.addendumPlaceholder')}
            />
          )}
          {!useDefaultAddendum && errors.addendum && (
            <p className="text-[11px] text-red mt-1">{errors.addendum.message}</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
