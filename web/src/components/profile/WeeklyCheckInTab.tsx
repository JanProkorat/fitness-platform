import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { Select } from '@/components/ui';
import { useToastStore } from '@/stores/toast';
import {
  getCheckInSettings,
  getCheckInOverrides,
  upsertCheckInSetting,
  DAY_OF_WEEK_KEYS,
  ORDERED_DAYS,
  DEADLINE_OFFSET_OPTIONS,
  formatTimeDisplay,
  toTimeSpanString,
} from '@/api/weekly-checkins';
import type {
  Profession,
  DayOfWeekInt,
  DeadlineOffsetHours,
  CheckInSettingDto,
  CheckInOverrideDto,
} from '@/api/weekly-checkins';
import { OverrideDialog } from './OverrideDialog';

/* ─────────────────────── Constants (byte-identical to TrainerProfileFields) ─────────────────────── */

const cardStyle: CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 18px',
};

const innerRowStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
};

/* ─────────────────────── Other Constants ─────────────────────── */

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

const deadlineOffsetSchema = z.union([
  z.literal(24), z.literal(48), z.literal(72), z.literal(120), z.literal(168),
]);

const settingSchema = z.object({
  enabled: z.boolean(),
  /** DayOfWeek as int (0=Sunday…6=Saturday) */
  dayOfWeek: dayOfWeekSchema,
  /** "HH:mm" — converted to "HH:mm:ss" before sending */
  timeOfDay: z.string().regex(/^\d{2}:00$/, 'Invalid time'),
  defaultAddendum: z.string().max(200, 'Max 200 characters').nullable(),
  /** Hours until check-in expires; must be one of DEADLINE_OFFSET_OPTIONS. */
  deadlineOffsetHours: deadlineOffsetSchema,
});
type SettingForm = z.infer<typeof settingSchema>;

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

/* ─────────────────────── ProfessionBlock handle ─────────────────────── */

interface ProfessionBlockHandle {
  submit: () => Promise<void>;
  resetDirty: () => void;
}

/* ─────────────────────── Per-profession block ─────────────────────── */

interface ProfessionBlockProps {
  profession: Profession;
  setting: CheckInSettingDto | undefined;
  onDirtyChange?: (dirty: boolean) => void;
}

const ProfessionBlock = forwardRef<ProfessionBlockHandle, ProfessionBlockProps>(
  function ProfessionBlock({ profession, setting, onDirtyChange }, ref) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const addToast = useToastStore((s) => s.addToast);

    const defaultValues: SettingForm = {
      enabled: setting?.enabled ?? true,
      dayOfWeek: setting?.dayOfWeek ?? DEFAULT_DAY,
      timeOfDay: setting ? formatTimeDisplay(setting.timeOfDay) : DEFAULT_HOUR,
      defaultAddendum: setting?.defaultAddendum ?? null,
      deadlineOffsetHours: setting?.deadlineOffsetHours ?? 72,
    };

    const {
      register,
      handleSubmit,
      control,
      watch,
      reset,
      formState: { errors, isDirty },
    } = useForm<SettingForm>({
      resolver: zodResolver(settingSchema),
      defaultValues,
    });

    const enabled = watch('enabled');
    const addendum = watch('defaultAddendum') ?? '';

    // Propagate dirty state to parent
    useEffect(() => {
      onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const onSubmit = useCallback(async (data: SettingForm) => {
      try {
        await upsertCheckInSetting({
          profession,
          dayOfWeek: data.dayOfWeek,
          timeOfDay: toTimeSpanString(data.timeOfDay),
          enabled: data.enabled,
          defaultAddendum: data.defaultAddendum || null,
          deadlineOffsetHours: data.deadlineOffsetHours,
        });
        // Reset RHF defaults to submitted values so isDirty flips false.
        // Do NOT reset on the error branch — the form stays dirty so the user
        // knows they still have unsaved edits.
        reset(data);
        void queryClient.invalidateQueries({ queryKey: ['weekly-checkin-settings'] });
        addToast(t('weeklyCheckIn.config.saved'), 'success');
      } catch {
        addToast(t('weeklyCheckIn.config.saveError'), 'error');
      }
    }, [profession, reset, queryClient, addToast, t]);

    useImperativeHandle(ref, () => ({
      submit: () => handleSubmit(onSubmit)(),
      // Clears isDirty without altering displayed values. Used by the
      // leave-without-saving flow in ProfilePage so the dirty useEffect
      // doesn't re-fire after the parent has set checkInDirty=false.
      resetDirty: () => {
        const currentValues = {
          enabled: watch('enabled'),
          dayOfWeek: watch('dayOfWeek'),
          timeOfDay: watch('timeOfDay'),
          defaultAddendum: watch('defaultAddendum'),
          deadlineOffsetHours: watch('deadlineOffsetHours'),
        };
        reset(currentValues, { keepValues: true });
      },
    }), [handleSubmit, onSubmit, reset, watch]);

    const professionLabel =
      profession === 'Training'
        ? t('weeklyCheckIn.professionTraining')
        : t('weeklyCheckIn.professionNutrition');

    return (
      <>
        {/* Section heading outside the card — matches .section-heading pattern */}
        <div className="section-heading" style={{ marginBottom: 12 }}>
          {professionLabel}
        </div>

        <div style={{ ...cardStyle, marginBottom: 14 }}>
          {/* Enabled toggle — toggle-wrap / toggle-lbl / .toggle.on pattern */}
          <div
            className="toggle-wrap"
            style={{ ...innerRowStyle, marginBottom: 14 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toggle-lbl">{t('weeklyCheckIn.config.enabled')}</div>
            </div>
            <Controller
              name="enabled"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  className={`toggle${field.value ? ' on' : ''}`}
                  onClick={() => field.onChange(!field.value)}
                  aria-pressed={field.value}
                  aria-label={t('weeklyCheckIn.config.enabled')}
                >
                  <span className="toggle-thumb" />
                </button>
              )}
            />
          </div>

          {/* Day of week + Time — two-column form-row grid */}
          <div className="form-row" style={{ marginBottom: 14, opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
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

          {/* Deadline offset — how many hours until the check-in auto-expires */}
          <div
            className="form-group"
            style={{ marginBottom: 14, opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none' }}
          >
            <label className="form-label">
              {t('weeklyCheckIn.settings.deadlineLabel')}
            </label>
            <Controller
              name="deadlineOffsetHours"
              control={control}
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value) as DeadlineOffsetHours)}
                >
                  {DEADLINE_OFFSET_OPTIONS.map((h) => (
                    <option key={h} value={String(h)}>
                      {t(`weeklyCheckIn.settings.deadlineOption.h${h}`)}
                    </option>
                  ))}
                </Select>
              )}
            />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              {t('weeklyCheckIn.settings.deadlineHint')}
            </p>
            {errors.deadlineOffsetHours && (
              <p className="text-[11px] text-red mt-1">{errors.deadlineOffsetHours.message}</p>
            )}
          </div>

          {/* Addendum textarea — matches Bio pattern: label + counter aligned right */}
          <div
            className="form-group"
            style={{
              marginBottom: 0,
              opacity: enabled ? 1 : 0.4,
              pointerEvents: enabled ? 'auto' : 'none',
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                {t('weeklyCheckIn.config.addendum')}
              </label>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {addendum.length}/200
              </span>
            </div>
            <textarea
              {...register('defaultAddendum')}
              rows={3}
              maxLength={200}
              className="form-input"
              style={{ resize: 'vertical' }}
              placeholder={t('weeklyCheckIn.config.addendumPlaceholder')}
            />
            {errors.defaultAddendum && (
              <p className="text-[11px] text-red mt-1">{errors.defaultAddendum.message}</p>
            )}
          </div>
        </div>
      </>
    );
  },
);

/* OverrideDialog is imported from ./OverrideDialog — see that file for the implementation. */

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

/* ─────────────────────── WeeklyCheckInTab handle ─────────────────────── */

export interface WeeklyCheckInTabHandle {
  save: () => Promise<void>;
  resetDirty: () => void;
}

/* ─────────────────────── Main tab ─────────────────────── */

interface WeeklyCheckInTabProps {
  /** The trainer's role array from the auth store */
  roles: string[];
  onSavingChange?: (saving: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const WeeklyCheckInTab = forwardRef<WeeklyCheckInTabHandle, WeeklyCheckInTabProps>(
  function WeeklyCheckInTab({ roles, onSavingChange, onDirtyChange }, ref) {
    const { t } = useTranslation();
    const [selectedOverride, setSelectedOverride] = useState<CheckInOverrideDto | null>(null);

    const trainingRef = useRef<ProfessionBlockHandle>(null);
    const nutritionRef = useRef<ProfessionBlockHandle>(null);

    const isTrainer = roles.includes('Trainer');
    const isNutritionist = roles.includes('Nutritionist');

    // Per-block dirty tracking. Mirror the conditional render guards so an
    // unmounted block contributes false to the aggregate.
    const [trainingDirty, setTrainingDirty] = useState(false);
    const [nutritionDirty, setNutritionDirty] = useState(false);
    const anyDirty = (isTrainer && trainingDirty) || (isNutritionist && nutritionDirty);

    useEffect(() => {
      onDirtyChange?.(anyDirty);
    }, [anyDirty, onDirtyChange]);

    const { data: settingsResponse, isLoading: settingsLoading } = useQuery({
      queryKey: ['weekly-checkin-settings'],
      queryFn: getCheckInSettings,
    });

    const { data: overridesResponse, isLoading: overridesLoading } = useQuery({
      queryKey: ['weekly-checkin-overrides'],
      queryFn: getCheckInOverrides,
    });

    useImperativeHandle(ref, () => ({
      save: async () => {
        onSavingChange?.(true);
        try {
          const saves: Promise<void>[] = [];
          if (isTrainer && trainingRef.current) saves.push(trainingRef.current.submit());
          if (isNutritionist && nutritionRef.current) saves.push(nutritionRef.current.submit());
          await Promise.all(saves);
        } finally {
          onSavingChange?.(false);
        }
      },
      // Clears RHF isDirty on each visible block so the parent's onDirtyChange
      // useEffect doesn't re-fire true after confirmLeave sets checkInDirty=false.
      resetDirty: () => {
        if (isTrainer) trainingRef.current?.resetDirty();
        if (isNutritionist) nutritionRef.current?.resetDirty();
      },
    }), [isTrainer, isNutritionist, onSavingChange]);

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
        {/* Per-profession blocks — section heading rendered inside ProfessionBlock, outside card */}
        {isTrainer && (
          <ProfessionBlock
            ref={trainingRef}
            profession="Training"
            setting={trainingSetting}
            onDirtyChange={setTrainingDirty}
          />
        )}
        {isNutritionist && (
          <ProfessionBlock
            ref={nutritionRef}
            profession="Nutrition"
            setting={nutritionSetting}
            onDirtyChange={setNutritionDirty}
          />
        )}

        {/* Per-client overrides — section heading outside, card chrome wraps table/empty state */}
        <div className="section-heading" style={{ marginTop: 8, marginBottom: 12 }}>
          {t('weeklyCheckIn.config.overrides')}
          {totalCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text2)',
                marginLeft: 8,
              }}
            >
              {t('weeklyCheckIn.config.defaultsHeader', {
                count: defaultsCount,
                total: totalCount,
              })}
            </span>
          )}
        </div>

        <div style={cardStyle}>
          {overridesLoading ? (
            <div className="text-[13px] text-text3 py-4">{t('common.loading')}</div>
          ) : overrides.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-text3">
              {t('weeklyCheckIn.config.noOverrides')}
            </div>
          ) : (
            <div style={{ margin: '-16px -18px', overflow: 'hidden', borderRadius: 8 }}>
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
  },
);
