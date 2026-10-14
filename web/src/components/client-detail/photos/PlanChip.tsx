import { useTranslation } from 'react-i18next';
import { Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import HorizontalDumbbellIcon from '@/components/clients/HorizontalDumbbellIcon';
import type { PhotoPlanInfo } from '@/components/client-detail/photos/photosModel';

export function PlanKindIcon({ kind, className }: { kind: PhotoPlanInfo['kind']; className?: string }) {
  if (kind === 'training') {
    return <HorizontalDumbbellIcon className={className} />;
  }
  return <Utensils className={className} aria-hidden="true" />;
}

/** Plan name chip under a photo card; "Plan removed" when the plan has no name. */
export default function PlanChip({ plan }: { plan: PhotoPlanInfo }) {
  const { t } = useTranslation();
  const removed = plan.name === null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-meta font-semibold',
        removed
          ? 'bg-muted text-muted-foreground'
          : plan.kind === 'training'
            ? 'bg-training-soft text-training-ink'
            : 'bg-nutrition-soft text-nutrition-ink',
      )}
    >
      <PlanKindIcon kind={plan.kind} className="size-3.5 shrink-0" />
      <span className="truncate">{plan.name ?? t('clientDetail.photos.planRemoved')}</span>
    </span>
  );
}
