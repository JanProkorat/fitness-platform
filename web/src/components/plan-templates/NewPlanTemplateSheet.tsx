import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Minus, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MealKind, PrimaryGoal } from '@/api/nutrition-plan-templates';
import { useCreatePlanTemplate } from '@/hooks/usePlanTemplatesQueries';
import GoalDot from '@/components/plan-templates/GoalDot';
import {
  buildTemplateWeeks,
  DEFAULT_MEAL_KINDS,
  GOAL_ORDER,
  MAX_WEEKS,
  MEAL_SLOTS,
  MIN_WEEKS,
} from '@/components/plan-templates/plan-template-tree';
import { cn } from '@/lib/utils';

const DAYS_PER_WEEK = 7;
const DEFAULT_WEEKS = 4;
const MAX_DAILY_KCAL = 20000;

const CHIP_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-body font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50';
const CHIP_IDLE_CLASS = 'border-line bg-card text-ink hover:bg-muted';
const CHIP_ACTIVE_CLASS = 'border-ink bg-ink text-primary-foreground';

// react-hook-form also runs setValueAs on the default value, which can be a number.
function optionalKcal(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return Number(value);
}

const formSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  goal: z.enum(PrimaryGoal),
  weeks: z.number().int().min(MIN_WEEKS).max(MAX_WEEKS),
  mealKinds: z.array(z.enum(MealKind)),
  dailyKcal: z.number().int().min(1).max(MAX_DAILY_KCAL).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function NewPlanTemplateForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreatePlanTemplate();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      goal: undefined,
      weeks: DEFAULT_WEEKS,
      mealKinds: [...DEFAULT_MEAL_KINDS],
      dailyKcal: undefined,
    },
  });
  const goal = watch('goal');
  const weeks = watch('weeks');
  const mealKinds = watch('mealKinds');

  function toggleMealKind(kind: MealKind) {
    const next = mealKinds.includes(kind) ? mealKinds.filter((item) => item !== kind) : [...mealKinds, kind];
    setValue('mealKinds', next, { shouldValidate: true, shouldDirty: true });
  }

  function onValid(values: FormValues) {
    const description = values.description.trim();
    createMutation.mutate(
      {
        name: values.name.trim(),
        description: description === '' ? undefined : description,
        goal: values.goal,
        globalSettings: values.dailyKcal === undefined ? undefined : { dailyKcal: values.dailyKcal },
        weeks: buildTemplateWeeks(values.weeks, values.mealKinds),
      },
      {
        onSuccess: (created) => {
          onClose();
          navigate(`/plan-templates/${created.templateId}`);
        },
      },
    );
  }

  return (
    <>
      <form
        id="new-plan-template-form"
        onSubmit={handleSubmit(onValid)}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-template-name">
            {t('planTemplates.new.name')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="plan-template-name"
            {...register('name')}
            aria-invalid={!!errors.name}
            placeholder={t('planTemplates.new.namePlaceholder')}
            className="h-10"
          />
          {errors.name && <p className="text-meta text-destructive">{t('planTemplates.new.nameInvalid')}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-template-description">{t('planTemplates.new.description')}</Label>
          <Textarea
            id="plan-template-description"
            rows={3}
            {...register('description')}
            aria-invalid={!!errors.description}
            placeholder={t('planTemplates.new.descriptionPlaceholder')}
          />
          {errors.description && (
            <p className="text-meta text-destructive">{t('planTemplates.new.descriptionInvalid')}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span id="plan-template-goal-label" className="text-body font-medium text-foreground">
            {t('planTemplates.new.goal')} <span className="text-destructive">*</span>
          </span>
          <div role="radiogroup" aria-labelledby="plan-template-goal-label" className="flex flex-wrap gap-2">
            {GOAL_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={goal === value}
                onClick={() => setValue('goal', value, { shouldValidate: true, shouldDirty: true })}
                className={cn(CHIP_CLASS, goal === value ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS)}
              >
                <GoalDot goal={value} />
                {t(`nutritionGoals.goal_${value}`)}
              </button>
            ))}
          </div>
          {errors.goal ? (
            <p className="text-meta text-destructive">{t('planTemplates.new.goalRequired')}</p>
          ) : (
            <p className="text-meta text-muted-foreground">{t('planTemplates.new.goalHint')}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span id="plan-template-weeks-label" className="text-body font-medium text-foreground">
            {t('planTemplates.new.weeks')} <span className="text-destructive">*</span>
          </span>
          <div className="flex items-center gap-3" role="group" aria-labelledby="plan-template-weeks-label">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('planTemplates.new.weeksDecrease')}
              disabled={weeks <= MIN_WEEKS}
              onClick={() => setValue('weeks', weeks - 1, { shouldValidate: true, shouldDirty: true })}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <span
              className="min-w-10 text-center text-stat font-semibold text-ink"
              data-testid="plan-template-weeks-value"
              aria-live="polite"
            >
              {weeks}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('planTemplates.new.weeksIncrease')}
              disabled={weeks >= MAX_WEEKS}
              onClick={() => setValue('weeks', weeks + 1, { shouldValidate: true, shouldDirty: true })}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
            <span className="text-body text-muted-foreground">
              {t('planTemplates.new.weeksSummary', { count: weeks, days: weeks * DAYS_PER_WEEK })}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id="plan-template-meals-label" className="text-body font-medium text-foreground">
            {t('planTemplates.new.meals')}
          </span>
          <div role="group" aria-labelledby="plan-template-meals-label" className="flex flex-wrap gap-2">
            {MEAL_SLOTS.map((slot) => {
              const selected = mealKinds.includes(slot.kind);
              return (
                <button
                  key={slot.kind}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleMealKind(slot.kind)}
                  className={cn(CHIP_CLASS, selected ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS)}
                >
                  {selected && <Check className="size-3.5" aria-hidden="true" />}
                  {t(`planTemplates.slots.${slot.labelKey}`)}
                </button>
              );
            })}
          </div>
          <p className="text-meta text-muted-foreground">{t('planTemplates.new.mealsHint')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-template-kcal">
            {t('planTemplates.new.dailyKcal')}{' '}
            <span className="font-normal text-muted-foreground">{t('planTemplates.new.optional')}</span>
          </Label>
          <div className="relative w-56">
            <Input
              id="plan-template-kcal"
              type="text"
              inputMode="numeric"
              {...register('dailyKcal', { setValueAs: optionalKcal })}
              aria-invalid={!!errors.dailyKcal}
              className="h-10 pr-12"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body text-muted-foreground">
              {t('planTemplates.new.kcalUnit')}
            </span>
          </div>
          {errors.dailyKcal && <p className="text-meta text-destructive">{t('planTemplates.new.kcalInvalid')}</p>}
        </div>
      </form>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-6">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="new-plan-template-form" disabled={createMutation.isPending}>
          {t('planTemplates.new.submit')}
        </Button>
      </SheetFooter>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Right-hand drawer that sets a new plan template's frame (name, goal, length, meal slots) and opens the editor. */
export default function NewPlanTemplateSheet({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:w-drawer sm:max-w-none">
        <SheetHeader className="gap-1 border-b border-border p-6">
          <SheetTitle className="text-panel-title font-bold">{t('planTemplates.new.title')}</SheetTitle>
          <SheetDescription className="text-body">{t('planTemplates.new.subtitle')}</SheetDescription>
        </SheetHeader>
        <NewPlanTemplateForm onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
