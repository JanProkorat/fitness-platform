import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Toggle, Select, Dialog } from '@/components/ui';
import { useToastStore } from '@/stores/toast';
import {
  getCheckInSettings,
  getCheckInOverrides,
  upsertCheckInSetting,
  upsertCheckInOverride,
  deleteCheckInOverride,
  DAY_OF_WEEK_KEYS,
  ORDERED_DAYS,
  formatTimeDisplay,
  toTimeSpanString,
} from '@/api/weekly-checkins';
import type {
  Profession,
  DayOfWeekInt,
  CheckInSettingDto,
  CheckInOverrideDto,
} from '@/api/weekly-checkins';

/* ─────────────────────── Constants ─────────────────────── */

/** Hour options from 06:00 to 22:00, rendered as "HH:mm". Wire value is "HH:mm:ss". */
const HOUR_OPTIONS: string[] = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${String(h).padStart(2, '0')}:00`;
});

/** Default hour:minute string used when no setting exists yet. */
const DEFAULT_HOUR = '09:00';

/** Default DayOfWeek int: Monday = 1. */
const DEFAULT_DAY: DayOfWeekInt = 1;

/* ─────────────────────── Zod schemas ─────────────────────── */

const dayOfWeekSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6),
]);

const settingSchema = z.object({
  enabled: z.boolean(),
  /** DayOfWeek as int (0=Sunday…6=Saturday) */
  dayOfWeek: dayOfWeekSchema,
  /** "HH:mm" — converted to "HH:mm:ss" before sending */
  timeOfDay: z.string().regex(/^\d{2}:00$/, 'Invalid time'),
  defaultAddendum: z.string().max(200, 'Max 200 characters').nullable(),
});
type SettingForm = z.infer<typeof settingSchema>;

const overrideSchema = z.object({
  useDefaultDay: z.boolean(),
  dayOfWeek: dayOfWeekSchema.nullable(),
  useDefaultTime: z.boolean(),
  /** "HH:mm" display value */
  timeOfDay: z.string().nullable(),
  useDefaultEnabled: z.boolean(),
  enabled: z.boolean().nullable(),
  useDefaultAddendum: z.boolean(),
  addendum: z.string().max(200, 'Max 200 characters').nullable(),
});
type OverrideForm = z.infer<typeof overrideSchema>;

/* ─────────────────────── Helpers ────────────────────────── */

/**
 * Derives effective values for an override by merging it with the trainer's default
 * setting for the same profession. When an override field is null it means "inherit".
 */
function resolveEffective(
  override: CheckInOverrideDto,
  settings: CheckInSettingDto[],
): {
  effectiveDayOfWeek: DayOfWeekInt;
  effectiveTimeDisplay: string;
  effectiveEnabled: boolean;
} {
  const setting = settings.find((s) => s.profession === override.profession);

  const effectiveDayOfWeek: DayOfWeekInt =
    override.dayOfWeek !== null ? override.dayOfWeek : (setting?.dayOfWeek ?? DEFAULT_DAY);

  const effectiveTimeDisplay =
    override.timeOfDay !== null
      ? formatTimeDisplay(override.timeOfDay)
      : setting
        ? formatTimeDisplay(setting.timeOfDay)
        : `${DEFAULT_HOUR}`;

  const effectiveEnabled: boolean =
    override.enabled !== null ? override.enabled : (setting?.enabled ?? true);

  return { effectiveDayOfWeek, effectiveTimeDisplay, effectiveEnabled };
}

/* ─────────────────────── Per-profession block ─────────────────────── */

interface ProfessionBlockProps {
  profession: Profession;
  setting: CheckInSettingDto | undefined;
}

function ProfessionBlock({ profession, setting }: ProfessionBlockProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const defaultValues: SettingForm = {
    enabled: setting?.enabled ?? true,
    dayOfWeek: setting?.dayOfWeek ?? DEFAULT_DAY,
    timeOfDay: setting ? formatTimeDisplay(setting.timeOfDay) : DEFAULT_HOUR,
    defaultAddendum: setting?.defaultAddendum ?? null,
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SettingForm>({
    resolver: zodResolver(settingSchema),
    defaultValues,
  });

  const addendum = watch('defaultAddendum') ?? '';

  const onSubmit = async (data: SettingForm) => {
    try {
      await upsertCheckInSetting({
        profession,
        dayOfWeek: data.dayOfWeek,
        timeOfDay: toTimeSpanString(data.timeOfDay),
        enabled: data.enabled,
        defaultAddendum: data.defaultAddendum || null,
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-checkin-settings'] });
      addToast(t('weeklyCheckIn.config.saved'), 'success');
    } catch {
      addToast(t('weeklyCheckIn.config.saveError'), 'error');
    }
  };

  const professionLabel =
    profession === 'Training'
      ? t('weeklyCheckIn.professionTraining')
      : t('weeklyCheckIn.professionNutrition');

  return (
    <div className="border border-border-md rounded-md p-5 mb-5">
      <h3 className="text-[14px] font-semibold text-text mb-4">{professionLabel}</h3>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Enabled toggle */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-[13px] text-text">{t('weeklyCheckIn.config.enabled')}</span>
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Day of week + Time row */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-text2 mb-1.5">
              {t('weeklyCheckIn.config.dayOfWeek')}
            </label>
            <Controller
              name="dayOfWeek"
              control={control}
              render={({ field }) => (
                <Select
                  value={String(field.value)}
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
            {errors.dayOfWeek && (
              <p className="text-[11px] text-red mt-1">{errors.dayOfWeek.message}</p>
            )}
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-text2 mb-1.5">
              {t('weeklyCheckIn.config.time')}
            </label>
            <Controller
              name="timeOfDay"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              )}
            />
            {errors.timeOfDay && (
              <p className="text-[11px] text-red mt-1">{errors.timeOfDay.message}</p>
            )}
          </div>
        </div>

        {/* Addendum textarea */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-text2">
              {t('weeklyCheckIn.config.addendum')}
            </label>
            <span className="text-[11px] text-text3">
              {addendum.length}/200
            </span>
          </div>
          <textarea
            {...register('defaultAddendum')}
            rows={3}
            maxLength={200}
            className="w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] resize-vertical focus:outline-none focus:border-border-hv transition-colors"
            placeholder={t('weeklyCheckIn.config.addendumPlaceholder')}
          />
          {errors.defaultAddendum && (
            <p className="text-[11px] text-red mt-1">{errors.defaultAddendum.message}</p>
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────── Override dialog ─────────────────────── */

interface OverrideDialogProps {
  override: CheckInOverrideDto;
  settings: CheckInSettingDto[];
  onClose: () => void;
}

function OverrideDialog({ override, settings, onClose }: OverrideDialogProps) {
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
    mutationFn: () =>
      deleteCheckInOverride(override.clientUserId, override.profession),
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
        timeOfDay: data.useDefaultTime ? null : (data.timeOfDay ? toTimeSpanString(data.timeOfDay) : null),
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

  const clientName = `${override.clientFirstName} ${override.clientLastName}`;
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

/* ─────────────────────── Override row ─────────────────────── */

interface OverrideRowProps {
  override: CheckInOverrideDto;
  settings: CheckInSettingDto[];
  onClick: () => void;
}

function OverrideRow({ override, onClick, settings }: OverrideRowProps) {
  const { t } = useTranslation();
  const clientName = `${override.clientFirstName} ${override.clientLastName}`;
  const initials = `${override.clientFirstName[0] ?? ''}${override.clientLastName[0] ?? ''}`.toUpperCase();

  const isDefault =
    override.dayOfWeek === null &&
    override.timeOfDay === null &&
    override.enabled === null &&
    override.addendum === null;

  const professionLabel =
    override.profession === 'Training'
      ? t('weeklyCheckIn.professionTraining')
      : t('weeklyCheckIn.professionNutrition');

  const { effectiveDayOfWeek, effectiveTimeDisplay, effectiveEnabled } = resolveEffective(
    override,
    settings,
  );

  return (
    <tr
      className="border-b border-border hover:bg-bg-hover cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Avatar + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-bg3 text-text2 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <span className="text-[13px] text-text">{clientName}</span>
        </div>
      </td>

      {/* Profession */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-text2">{professionLabel}</span>
      </td>

      {/* Uses default? */}
      <td className="px-4 py-3">
        {isDefault ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-bg text-green border border-[var(--green-br)]">
            {t('weeklyCheckIn.config.usesDefault')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent-bg text-accent border border-accent-br">
            {t('weeklyCheckIn.config.customized')}
          </span>
        )}
      </td>

      {/* Day */}
      <td className="px-4 py-3">
        <span className="text-[13px] text-text">
          {t(`weeklyCheckIn.day.${DAY_OF_WEEK_KEYS[effectiveDayOfWeek]}`)}
        </span>
      </td>

      {/* Time */}
      <td className="px-4 py-3">
        <span className="text-[13px] text-text">{effectiveTimeDisplay}</span>
      </td>

      {/* Enabled */}
      <td className="px-4 py-3">
        <span
          className={`text-[12px] font-medium ${effectiveEnabled ? 'text-green' : 'text-text3'}`}
        >
          {effectiveEnabled
            ? t('weeklyCheckIn.config.active')
            : t('weeklyCheckIn.config.inactive')}
        </span>
      </td>
    </tr>
  );
}

/* ─────────────────────── Main tab ─────────────────────── */

interface WeeklyCheckInTabProps {
  /** The trainer's role array from the auth store */
  roles: string[];
}

export function WeeklyCheckInTab({ roles }: WeeklyCheckInTabProps) {
  const { t } = useTranslation();
  const [selectedOverride, setSelectedOverride] = useState<CheckInOverrideDto | null>(null);

  const isTrainer = roles.includes('Trainer');
  const isNutritionist = roles.includes('Nutritionist');

  const { data: settingsResponse, isLoading: settingsLoading } = useQuery({
    queryKey: ['weekly-checkin-settings'],
    queryFn: getCheckInSettings,
  });

  const { data: overridesResponse, isLoading: overridesLoading } = useQuery({
    queryKey: ['weekly-checkin-overrides'],
    queryFn: getCheckInOverrides,
  });

  // Zero state: trainer has neither Trainer nor Nutritionist role
  if (!isTrainer && !isNutritionist) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[13px] text-text2">{t('weeklyCheckIn.config.setSpecializationFirst')}</p>
      </div>
    );
  }

  const settings = settingsResponse?.settings ?? [];
  const overrides = overridesResponse?.overrides ?? [];

  const trainingSetting = settings.find((s) => s.profession === 'Training');
  const nutritionSetting = settings.find((s) => s.profession === 'Nutrition');

  const defaultsCount = overrides.filter(
    (o) =>
      o.dayOfWeek === null &&
      o.timeOfDay === null &&
      o.enabled === null &&
      o.addendum === null,
  ).length;
  const totalCount = overrides.length;

  if (settingsLoading) {
    return (
      <div className="py-8 text-center text-[13px] text-text3">{t('common.loading')}</div>
    );
  }

  return (
    <div className="page-content">
      {/* Per-profession blocks */}
      {isTrainer && (
        <ProfessionBlock
          profession="Training"
          setting={trainingSetting}
        />
      )}
      {isNutritionist && (
        <ProfessionBlock
          profession="Nutrition"
          setting={nutritionSetting}
        />
      )}

      {/* Per-client overrides table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-text">
            {t('weeklyCheckIn.config.overrides')}
          </h3>
          {totalCount > 0 && (
            <span className="text-[12px] text-text2">
              {t('weeklyCheckIn.config.defaultsHeader', {
                count: defaultsCount,
                total: totalCount,
              })}
            </span>
          )}
        </div>

        {overridesLoading ? (
          <div className="text-[13px] text-text3 py-4">{t('common.loading')}</div>
        ) : overrides.length === 0 ? (
          <div className="border border-border-md rounded-md px-4 py-8 text-center text-[13px] text-text3">
            {t('weeklyCheckIn.config.noOverrides')}
          </div>
        ) : (
          <div className="border border-border-md rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg2">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colClient')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colProfession')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colDefault')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colDay')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colTime')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text2 uppercase tracking-wide">
                    {t('weeklyCheckIn.config.colEnabled')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((override) => (
                  <OverrideRow
                    key={`${override.clientUserId}-${override.profession}`}
                    override={override}
                    settings={settings}
                    onClick={() => setSelectedOverride(override)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override dialog */}
      {selectedOverride && (
        <OverrideDialog
          override={selectedOverride}
          settings={settings}
          onClose={() => setSelectedOverride(null)}
        />
      )}
    </div>
  );
}
