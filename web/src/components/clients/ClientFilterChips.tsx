import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ClientListFilter, type ClientFilterCounts } from '@/api/generated';
import { cn } from '@/lib/utils';

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
 *
 * Count sits BEFORE the label ("2 All", not "All 2") and the chip itself is
 * a solid pill (active = green fill, inactive = grey fill) per the Figma
 * wireframe (frame client-list-02, #1066 phase 6).
 */
export default function ClientFilterChips({ active, counts, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('clients.chips.groupLabel')}>
      {CHIP_ORDER.map((chip) => {
        const count = counts?.[CHIP_COUNT_KEY[chip]];
        const isZero = chip !== ClientListFilter.All && count === 0;
        const isActive = active === chip;

        return (
          <Button
            key={chip}
            type="button"
            variant="ghost"
            size="sm"
            disabled={isZero && !isActive}
            aria-pressed={isActive}
            onClick={() => onSelect(chip)}
            className={cn(
              'gap-1.5 rounded-full px-3 py-1.5',
              isActive
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-line text-muted-foreground hover:bg-line/80',
            )}
          >
            {typeof count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-label font-semibold',
                  isActive ? 'bg-green-dark text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            )}
            {t(CHIP_LABEL_KEY[chip])}
          </Button>
        );
      })}
    </div>
  );
}
