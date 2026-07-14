import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Input } from '@/components/ui';
import { createPlan } from '@/api/plans';
import { createTrainingPlan } from '@/api/training-plans';
import { showApiError } from '@/lib/api-errors';

export type PlanCreateType = 'nutrition' | 'training';

export interface PlanCreateDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  planType: PlanCreateType;
  /** Called with the new plan's id once creation succeeds. */
  onCreated: (planId: string) => void;
}

/** "yyyy-MM-dd" for today if it's already a Monday, else the next upcoming Monday. */
function getDefaultMondayISODate(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat, Monday=1
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parses a "yyyy-MM-dd" `<input type="date">` value as a local calendar date. */
function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isMondayDateString(value: string): boolean {
  if (!value) return false;
  return parseDateInputValue(value).getDay() === 1;
}

function isTodayOrFutureDateString(value: string): boolean {
  if (!value) return false;
  const date = parseDateInputValue(value);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

/**
 * Create-plan dialog shared by the nutrition/training plan list pages and
 * the sidebar's per-client "+" affordance (#780 AC2). Backend enforces
 * StartDateNotMonday / StartDateInPast (see CreatePlanValidator) and rejects
 * overlapping date windows with 409 PLAN_OVERLAP (AC3) — this dialog guides
 * the trainer to a valid Monday up front and surfaces the overlap error via
 * the shared `apiErrors.PLAN_OVERLAP` translation instead of a generic toast.
 */
export function PlanCreateDialog({ open, onClose, clientId, planType, onCreated }: PlanCreateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const prefix = planType === 'nutrition' ? 'clientNutrition' : 'clientTraining';

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('planCreateDialog.nameRequired'))
          .max(200, t('planCreateDialog.nameTooLong')),
        startDate: z
          .string()
          .min(1, t('planCreateDialog.startDateRequired'))
          .refine(isMondayDateString, { message: t('planCreateDialog.startDateNotMonday') })
          .refine(isTodayOrFutureDateString, { message: t('planCreateDialog.startDateInPast') }),
        weekCount: z.coerce
          .number()
          .int(t('planCreateDialog.weekCountRequired'))
          .min(1, t('planCreateDialog.weekCountRange'))
          .max(52, t('planCreateDialog.weekCountRange')),
      }),
    [t],
  );
  // z.coerce.number()'s *input* type is `unknown` (it accepts any raw value
  // before coercing) while its *output* type is `number` — useForm needs
  // both generics so RHF's default-values/register typing (input) doesn't
  // fight the resolver's transformed result (output). Mirrors the pattern
  // already used in FoodDialog.tsx for the same z.coerce.number() case.
  type FormInput = z.input<typeof schema>;
  type FormValues = z.output<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', startDate: getDefaultMondayISODate(), weekCount: 4 },
  });

  // Re-seed a fresh Monday default + clear stale field values every time the
  // dialog reopens (it's mounted once per page/sidebar row and toggled via
  // `open`, not remounted).
  useEffect(() => {
    if (open) {
      reset({ name: '', startDate: getDefaultMondayISODate(), weekCount: 4 });
    }
  }, [open, reset]);

  const createMutation = useMutation({
    // Both create endpoints return their own detail shape (NutritionPlanDetail /
    // TrainingPlanDetail) — this dialog only ever needs the new planId, so
    // narrow to a common shape rather than unioning the two full types.
    mutationFn: async (values: FormValues): Promise<{ planId: string }> => {
      if (planType === 'nutrition') {
        const plan = await createPlan({
          clientId,
          name: values.name,
          startDate: values.startDate,
          weekCount: values.weekCount,
        });
        return { planId: plan.planId };
      }
      const plan = await createTrainingPlan({
        clientId,
        name: values.name,
        startDate: values.startDate,
        weekCount: values.weekCount,
      });
      return { planId: plan.planId };
    },
    onSuccess: (plan) => {
      // Every plan-list surface (list pages, the combined Plany tab, the
      // sidebar submenu, and the Prehled active-plan cards) reads through
      // one of these three query-key roots — invalidate all of them rather
      // than tracking each surface's exact key shape here.
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['training-plans'] });
      queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });

      if (plan?.planId) {
        onCreated(plan.planId);
      } else {
        onClose();
      }
    },
    onError: (err: unknown) => {
      // showApiError already prefers the specific errorCode translation
      // (apiErrors.PLAN_OVERLAP) over the fallback — no special-casing
      // needed here for the 409 overlap path (AC3).
      showApiError(err, `${prefix}.createError`);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(`${prefix}.createDialog.title`)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting || createMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit((values) => createMutation.mutate(values))}
            disabled={isSubmitting || createMutation.isPending}
          >
            {createMutation.isPending ? t('common.saving') : t('common.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
        <Input
          label={t(`${prefix}.createDialog.nameLabel`)}
          {...register('name')}
          error={errors.name?.message}
        />
        <Input
          label={t(`${prefix}.createDialog.startDateLabel`)}
          type="date"
          hint={t('planCreateDialog.mondayHint')}
          {...register('startDate')}
          error={errors.startDate?.message}
        />
        <Input
          label={t(`${prefix}.createDialog.weekCountLabel`)}
          type="number"
          min={1}
          max={52}
          {...register('weekCount', { valueAsNumber: true })}
          error={errors.weekCount?.message}
        />
      </form>
    </Dialog>
  );
}
