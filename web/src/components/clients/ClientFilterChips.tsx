import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ClientListFilter, type ClientFilterCounts } from '@/api/generated';

const CHIP_ORDER: ClientListFilter[] = [
  ClientListFilter.All,
  ClientListFilter.UnreadMessages,
  ClientListFilter.NoMessages,
  ClientListFilter.NewCheckIns,
  ClientListFilter.MissingCheckIns,
  ClientListFilter.EndingSoon,
];

const CHIP_COUNT_KEY: Record<ClientListFilter, keyof ClientFilterCounts> = {
  [ClientListFilter.All]: 'all',
  [ClientListFilter.UnreadMessages]: 'unreadMessages',
  [ClientListFilter.NoMessages]: 'noMessages',
  [ClientListFilter.NewCheckIns]: 'newCheckIns',
  [ClientListFilter.MissingCheckIns]: 'missingCheckIns',
  [ClientListFilter.EndingSoon]: 'endingSoon',
};

const CHIP_LABEL_KEY: Record<ClientListFilter, string> = {
  [ClientListFilter.All]: 'clients.chips.all',
  [ClientListFilter.UnreadMessages]: 'clients.chips.unreadMessages',
  [ClientListFilter.NoMessages]: 'clients.chips.noMessages',
  [ClientListFilter.NewCheckIns]: 'clients.chips.newCheckIns',
  [ClientListFilter.MissingCheckIns]: 'clients.chips.missingCheckIns',
  [ClientListFilter.EndingSoon]: 'clients.chips.endingSoon',
};

interface Props {
  active: ClientListFilter;
  counts?: ClientFilterCounts;
  onSelect: (chip: ClientListFilter) => void;
}

/**
 * The six surviving filter chips. A chip's count is computed with the
 * current tab/search/tags applied but the chip itself not — see
 * `ClientFilterCounts` in generated.ts — which is exactly what lets a
 * zero-count chip grey out here without losing the ability to select it
 * (clearing to an empty result is still a valid, if unhelpful, state).
 */
export default function ClientFilterChips({ active, counts, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('clients.chips.groupLabel')}>
      {CHIP_ORDER.map((chip) => {
        const count = counts?.[CHIP_COUNT_KEY[chip]];
        const isZero = chip !== ClientListFilter.All && count === 0;

        return (
          <Button
            key={chip}
            type="button"
            size="sm"
            variant={active === chip ? 'default' : 'outline'}
            disabled={isZero && active !== chip}
            aria-pressed={active === chip}
            onClick={() => onSelect(chip)}
          >
            {t(CHIP_LABEL_KEY[chip])}
            {typeof count === 'number' && <span className="text-caption opacity-80">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}
