import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  /** True when search/chip/tags narrow the tab and produced zero rows. */
  hasActiveFilter: boolean;
  onClearFilters: () => void;
}

/**
 * Two distinct empty states, not one. Conflating "no clients at all" with
 * "the filter excluded everything" strands a coach in an empty table with
 * no way out — see design review finding + PLAN-1066 §3.
 *
 * The "add client" affordance ships disabled: the invite drawer is phase 4
 * (deliberately out of scope here), so a working click has nothing to open.
 * Same treatment as `ClientRowMenu`'s disabled detail link — a labelled,
 * `disabled` action with a "coming soon" hint beats a dead click.
 */
export default function ClientsEmptyState({ hasActiveFilter, onClearFilters }: Props) {
  const { t } = useTranslation();

  if (hasActiveFilter) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-body font-medium text-foreground">{t('clients.noResultsForFilters')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          {t('clients.clearFilters')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-body font-medium text-foreground">{t('clients.noClients')}</p>
      <p className="text-caption text-muted-foreground">{t('clients.noClientsHint')}</p>
      <Button type="button" variant="default" size="sm" disabled title={t('clients.comingSoon')}>
        {t('clients.inviteClient')}
      </Button>
    </div>
  );
}
