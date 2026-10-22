import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackageBillingInterval, PaymentCurrency, type CoachPackageDto } from '@/api/coach-packages';
import {
  CELL_CLASS,
  CELL_TEXT_CLASS,
  CatalogTile,
  HEAD_CLASS,
  RowMenu,
  StateRows,
  StatusBadge,
} from '@/components/package-catalog/catalogParts';
import { formatMoney } from '@/lib/money';

const COLUMN_COUNT = 7;

interface Props {
  packages: CoachPackageDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (item: CoachPackageDto) => void;
  onArchive: (item: CoachPackageDto) => void;
}

/** The coach's packages: name and description, price, billing, client count, status and profile visibility. */
export default function PackagesTable({ packages, isPending, isError, onRetry, onEdit, onArchive }: Props) {
  const { t, i18n } = useTranslation();

  const billingLabel = (item: CoachPackageDto): string =>
    item.billing === PackageBillingInterval.EveryNWeeks
      ? t('packages.billingEveryN', { count: item.intervalWeeks ?? 0 })
      : t(`packages.billing.${item.billing ?? PackageBillingInterval.Monthly}`);

  return (
    <Table className="min-w-220">
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className={HEAD_CLASS}>{t('packages.table.package')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.price')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.billing')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.clients')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.status')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.publicProfile')}</TableHead>
          <TableHead className="w-12 px-4 py-3.5">
            <span className="sr-only">{t('packages.table.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <StateRows
          columnCount={COLUMN_COUNT}
          isPending={isPending}
          isError={isError}
          isEmpty={packages.length === 0}
          emptyKey="packages.empty"
          onRetry={onRetry}
        />
        {!isPending &&
          !isError &&
          packages.map((item) => {
            const id = item.packageId ?? '';
            const name = item.name ?? '';
            const archived = item.archivedAt != null;
            return (
              <TableRow
                key={id}
                className={archived ? 'border-line' : 'cursor-pointer border-line'}
                onClick={archived ? undefined : () => onEdit(item)}
              >
                <TableCell className={CELL_CLASS}>
                  <div className="flex items-center gap-3">
                    <CatalogTile muted={archived}>
                      <Package className="size-4.5" aria-hidden="true" />
                    </CatalogTile>
                    <div className="flex min-w-0 max-w-80 flex-col">
                      {archived ? (
                        <span className="truncate text-copy font-semibold text-ink">{name}</span>
                      ) : (
                        <button
                          type="button"
                          className="truncate text-left text-copy font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(item);
                          }}
                        >
                          {name}
                        </button>
                      )}
                      {item.description && (
                        <span className="truncate text-meta text-muted-foreground">{item.description}</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-copy font-semibold text-ink`}>
                  {formatMoney(item.price ?? 0, item.currency ?? PaymentCurrency.CZK, i18n.language)}
                </TableCell>
                <TableCell className={CELL_TEXT_CLASS}>{billingLabel(item)}</TableCell>
                <TableCell className={CELL_TEXT_CLASS}>
                  {t('packages.table.clientCount', { count: item.clientCount ?? 0 })}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <StatusBadge status={archived ? 'archived' : 'active'} />
                </TableCell>
                <TableCell className={CELL_TEXT_CLASS}>
                  {item.showOnProfile ? t('packages.table.onProfile') : t('packages.table.hidden')}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  {!archived && <RowMenu name={name} onEdit={() => onEdit(item)} onArchive={() => onArchive(item)} />}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
