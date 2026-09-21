import { useTranslation } from 'react-i18next';
import { Dumbbell, Utensils } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import ClientAvatar from '@/components/clients/ClientAvatar';
import { Profession, type ClientActivePlanDto } from '@/api/generated';

interface Props {
  activePlans: ClientActivePlanDto[];
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
}

function PlanTypeIcon({ type }: { type?: Profession }) {
  return type === Profession.Nutrition ? (
    <Utensils className="size-4 shrink-0" aria-hidden="true" />
  ) : (
    <Dumbbell className="size-4 shrink-0" aria-hidden="true" />
  );
}

/** Plan-type label, falling back to Training consistently with PlanTypeIcon's own fallback. */
function planTypeLabel(t: (key: string) => string, type?: Profession): string {
  return type === Profession.Nutrition ? t('clients.table.planType.nutrition') : t('clients.table.planType.training');
}

/** Plan-type icons for a client row, with a hover popover listing the active plans. */
export default function PlanIconsCell({ activePlans, firstName, lastName, avatarBlobUrl }: Props) {
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
          aria-label={t('clients.table.activePlanCount', { count: activePlans.length })}
        >
          {hasTraining && <Dumbbell className="size-4" aria-hidden="true" />}
          {hasNutrition && <Utensils className="size-4" aria-hidden="true" />}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64">
        <div className="flex items-center gap-2">
          <ClientAvatar firstName={firstName} lastName={lastName} avatarBlobUrl={avatarBlobUrl} />
          <div className="flex flex-col">
            <span className="text-body font-medium text-foreground">{`${firstName ?? ''} ${lastName ?? ''}`.trim()}</span>
            <span className="text-caption text-muted-foreground">
              {t('clients.table.activePlanCount', { count: activePlans.length })}
            </span>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {activePlans.map((plan, index) => (
            // Plans carry no id on this DTO — see ClientActivePlanDto in
            // generated.ts, a display-only projection. Index is stable
            // because this list is never reordered client-side.
            <li key={index} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <PlanTypeIcon type={plan.type} />
                  <span className="min-w-0 truncate text-body font-medium text-foreground">
                    {planTypeLabel(t, plan.type)}
                  </span>
                </div>
                {plan.startDate && (
                  <span className="shrink-0 whitespace-nowrap text-caption text-muted-foreground">
                    {new Date(plan.startDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <span className="min-w-0 truncate text-caption text-muted-foreground" title={plan.name}>
                {plan.name}
              </span>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
