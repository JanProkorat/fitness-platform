import { useTranslation } from 'react-i18next';

type KnownPlanStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

const MODIFIER_MAP: Record<KnownPlanStatus, string> = {
  Active: 'tag-green',
  Completed: 'tag-acc',
  Draft: 'tag-gray',
  Archived: 'tag-gray',
};

/**
 * Small status chip shared by the per-type plan list pages (#780). Reuses
 * the same `.tag` modifier classes + `clientDetail.plany.status.*` copy as
 * the combined Plany tab table so all plan-list surfaces render status
 * identically.
 */
export function PlanStatusChip({ status }: { status: string | undefined }) {
  const { t } = useTranslation();
  const modifier = status != null ? (MODIFIER_MAP[status as KnownPlanStatus] ?? 'tag-gray') : 'tag-gray';
  const label = status
    ? t(`clientDetail.plany.status.${status.toLowerCase()}`, { defaultValue: status })
    : '—';
  return <span className={`tag ${modifier}`}>{label}</span>;
}
