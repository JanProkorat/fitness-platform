import { useTranslation } from 'react-i18next';
import { Dumbbell, Utensils } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Profession, type ClientActivePlanDto } from '@/api/generated';

interface Props {
  activePlans: ClientActivePlanDto[];
}

function PlanTypeIcon({ type }: { type?: Profession }) {
  return type === Profession.Nutrition ? (
    <Utensils className="size-4 shrink-0" aria-hidden="true" />
  ) : (
    <Dumbbell className="size-4 shrink-0" aria-hidden="true" />
  );
}

/** Plan-type icons for a client row, with a hover popover listing the active plans. */
export default function PlanIconsCell({ activePlans }: Props) {
  const { t } = useTranslation();

  if (activePlans.length === 0) {
    return <span className="text-caption text-muted-foreground">{t('clients.table.noActivePlans')}</span>;
  }

  const hasTraining = activePlans.some((plan) => plan.type === Profession.Training);
  const hasNutrition = activePlans.some((plan) => plan.type === Profession.Nutrition);

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('clients.table.plansAriaLabel', { count: activePlans.length })}
        >
          {hasTraining && <Dumbbell className="size-4" aria-hidden="true" />}
          {hasNutrition && <Utensils className="size-4" aria-hidden="true" />}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64">
        <ul className="flex flex-col gap-3">
          {activePlans.map((plan, index) => (
            // Plans carry no id on this DTO — see ClientActivePlanDto in
            // generated.ts, a display-only projection. Index is stable
            // because this list is never reordered client-side.
            <li key={index} className="flex items-start gap-2">
              <PlanTypeIcon type={plan.type} />
              <div className="flex flex-col">
                <span className="text-body font-medium text-foreground">{plan.name}</span>
                {plan.startDate && (
                  <span className="text-caption text-muted-foreground">
                    {t('clients.table.planSince', { date: new Date(plan.startDate).toLocaleDateString() })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
