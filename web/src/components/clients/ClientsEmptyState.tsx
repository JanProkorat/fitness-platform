import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  /** True when search/chip/tags narrow the tab and produced zero rows. */
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onInviteClient: () => void;
}

/**
 * Two distinct empty states, not one. Conflating "no clients at all" with
 * "the filter excluded everything" strands a coach in an empty table with
 * no way out — see design review finding + PLAN-1066 §3.
 */
export default function ClientsEmptyState({ hasActiveFilter, onClearFilters, onInviteClient }: Props) {
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
      <Button type="button" variant="default" size="sm" onClick={onInviteClient}>
        {t('clients.inviteClient')}
      </Button>
    </div>
  );
}
