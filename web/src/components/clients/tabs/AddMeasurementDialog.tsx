import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Input, Dialog, FormRow, FormRow3 } from '@/components/ui';
import { useToastStore } from '@/stores/toast';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  createClientMeasurement,
  type CreateClientMeasurementRequest,
} from '@/api/measurements';

/* ─────────────────────── Date/time helpers ─────────────────────── */

/** Local "today" as YYYY-MM-DD, matching a `<input type="date">` value. */
function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Current local time as HH:mm:ss, used to compose a full ISO datetime on submit. */
function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/* ─────────────────────── Zod schema ─────────────────────── */
// Error messages are stored as i18n keys and translated at render time
// (rather than plain English) — this dialog surfaces validation copy in
// cs/en/de per the i18n rule.

const numberField = z.preprocess(
  (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
  z
    .number({ error: 'clientDetail.mereni.dialog.validation.mustBeNumber' })
    .positive({ message: 'clientDetail.mereni.dialog.validation.mustBePositive' })
    .optional(),
);

const measurementSchema = z.object({
  measuredAt: z
    .string()
    .min(1, 'clientDetail.mereni.dialog.validation.dateRequired')
    .refine((v) => v <= todayLocalDateString(), 'clientDetail.mereni.dialog.validation.dateNotFuture'),
  weightKg: numberField,
  bodyFatPercentage: numberField,
  chestCm: numberField,
  waistCm: numberField,
  hipsCm: numberField,
  bicepsCm: numberField,
  thighsCm: numberField,
  notes: z.string().max(500, 'clientDetail.mereni.dialog.validation.notesTooLong').optional(),
});

// zodResolver needs the *pre-transform* shape for `defaultValues`/register (the
// preprocess'd number fields accept `unknown`) and the *post-transform* shape
// (numbers, NaN stripped to undefined) for the submit handler's `data` arg.
type MeasurementFormInput = z.input<typeof measurementSchema>;
type MeasurementForm = z.output<typeof measurementSchema>;

const NUMERIC_KEYS = [
  'weightKg',
  'bodyFatPercentage',
  'chestCm',
  'waistCm',
  'hipsCm',
  'bicepsCm',
  'thighsCm',
] as const;

/* ─────────────────────── Component ─────────────────────── */

export interface AddMeasurementDialogProps {
  clientId: string;
  onClose: () => void;
}

/**
 * Dialog for a trainer to manually record a client's body measurement.
 * Replaces the previous placeholder toast ("clients enter measurements from
 * the mobile app") — trainers now enter values directly (#789).
 */
export function AddMeasurementDialog({ clientId, onClose }: AddMeasurementDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeasurementFormInput, unknown, MeasurementForm>({
    resolver: zodResolver(measurementSchema),
    defaultValues: {
      measuredAt: todayLocalDateString(),
      weightKg: undefined,
      bodyFatPercentage: undefined,
      chestCm: undefined,
      waistCm: undefined,
      hipsCm: undefined,
      bicepsCm: undefined,
      thighsCm: undefined,
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientMeasurementRequest) =>
      createClientMeasurement(clientId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-measurements', clientId] });
      addToast(t('clientDetail.mereni.dialog.saved'), 'success');
      onClose();
    },
    onError: (err) => {
      addToast(getApiErrorMessage(err, 'clientDetail.mereni.dialog.saveError'), 'error');
    },
  });

  const onSubmit = (data: MeasurementForm) => {
    const hasAnyValue = NUMERIC_KEYS.some((key) => data[key] != null);
    if (!hasAnyValue) {
      setError('root', {
        message: t('clientDetail.mereni.dialog.validation.atLeastOneValue'),
      });
      return;
    }

    createMutation.mutate({
      measuredAt: new Date(`${data.measuredAt}T${nowTimeString()}`).toISOString(),
      weightKg: data.weightKg,
      bodyFatPercentage: data.bodyFatPercentage,
      chestCm: data.chestCm,
      waistCm: data.waistCm,
      hipsCm: data.hipsCm,
      bicepsCm: data.bicepsCm,
      thighsCm: data.thighsCm,
      notes: data.notes ? data.notes : undefined,
    });
  };

  const translatedError = (message: string | undefined): string | undefined =>
    message ? t(message) : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('clientDetail.mereni.dialog.title')}
      maxWidth={560}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="primary"
            form="add-measurement-form"
            disabled={isSubmitting || createMutation.isPending}
          >
            {isSubmitting || createMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <form id="add-measurement-form" onSubmit={handleSubmit(onSubmit)}>
        {errors.root && <p className="text-[12px] text-red mb-3">{errors.root.message}</p>}

        <Input
          type="date"
          max={todayLocalDateString()}
          label={t('clientDetail.mereni.dialog.date')}
          error={translatedError(errors.measuredAt?.message)}
          {...register('measuredAt')}
        />

        <FormRow>
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.weight')}
            error={translatedError(errors.weightKg?.message)}
            {...register('weightKg', { valueAsNumber: true })}
          />
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.bodyFat')}
            error={translatedError(errors.bodyFatPercentage?.message)}
            {...register('bodyFatPercentage', { valueAsNumber: true })}
          />
        </FormRow>

        <FormRow3>
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.chest')}
            error={translatedError(errors.chestCm?.message)}
            {...register('chestCm', { valueAsNumber: true })}
          />
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.waist')}
            error={translatedError(errors.waistCm?.message)}
            {...register('waistCm', { valueAsNumber: true })}
          />
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.hips')}
            error={translatedError(errors.hipsCm?.message)}
            {...register('hipsCm', { valueAsNumber: true })}
          />
        </FormRow3>

        <FormRow>
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.biceps')}
            error={translatedError(errors.bicepsCm?.message)}
            {...register('bicepsCm', { valueAsNumber: true })}
          />
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('clientDetail.mereni.dialog.thighs')}
            error={translatedError(errors.thighsCm?.message)}
            {...register('thighsCm', { valueAsNumber: true })}
          />
        </FormRow>

        <div className="mb-1">
          <label className="block text-xs font-medium text-text2 mb-1.5">
            {t('clientDetail.mereni.dialog.notes')}
          </label>
          <textarea
            {...register('notes')}
            rows={2}
            maxLength={500}
            className="w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] resize-vertical focus:outline-none focus:border-border-hv transition-colors"
            placeholder={t('clientDetail.mereni.dialog.notesPlaceholder')}
          />
          {errors.notes && (
            <p className="text-[11px] text-red mt-1">{translatedError(errors.notes.message)}</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
