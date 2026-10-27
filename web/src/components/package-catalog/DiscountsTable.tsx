import { useTranslation } from 'react-i18next';
import { Tag } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DiscountDuration,
  DiscountScope,
  DiscountType,
  type CoachDiscountDto,
} from '@/api/coach-discounts';
import { PaymentCurrency, type CoachPackageDto } from '@/api/coach-packages';
import {
  CELL_CLASS,
  CELL_TEXT_CLASS,
  CatalogTile,
  HEAD_CLASS,
  RowMenu,
  StateRows,
  StatusBadge,
} from '@/components/package-catalog/catalogParts';
import { discountStatus, formatDay } from '@/components/package-catalog/catalogFormat';
import { todayIsoDate } from '@/components/automations/automationRuleForm';
import { formatMoney } from '@/lib/money';

const COLUMN_COUNT = 8;

interface Props {
  discounts: CoachDiscountDto[];
  /** All packages, archived included, to name the ones a discount is limited to. */
  packages: CoachPackageDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (item: CoachDiscountDto) => void;
  onArchive: (item: CoachDiscountDto) => void;
}

/** The coach's discounts: value, packages it applies to, validity window, duration, usage and status. */
export default function DiscountsTable({ discounts, packages, isPending, isError, onRetry, onEdit, onArchive }: Props) {
  const { t, i18n } = useTranslation();
  const today = todayIsoDate();
  const packageNames = new Map(packages.map((pkg) => [pkg.packageId ?? '', pkg.name ?? ''] as const));

  const valueLabel = (item: CoachDiscountDto): string =>
    item.type === DiscountType.FixedAmount
      ? `−${formatMoney(item.value ?? 0, item.currency ?? PaymentCurrency.CZK, i18n.language)}`
      : `−${item.value ?? 0} %`;

  const appliesToLabel = (item: CoachDiscountDto): string => {
    if (item.scope === DiscountScope.SelectedPackages) {
      return (item.packageIds ?? []).map((id) => packageNames.get(id) ?? '').filter(Boolean).join(', ');
    }
    return t(`packages.discounts.scope.${item.scope ?? DiscountScope.AllPackages}`);
  };

  const validLabel = (item: CoachDiscountDto): string => {
    const from = item.validFrom ? formatDay(item.validFrom, i18n.language) : null;
    const to = item.validTo ? formatDay(item.validTo, i18n.language) : null;
    if (from && to) {
      return t('packages.discounts.valid.range', { from, to });
    }
    if (from) {
      return t('packages.discounts.valid.from', { date: from });
    }
    return to ? t('packages.discounts.valid.until', { date: to }) : t('packages.discounts.valid.always');
  };

  const durationLabel = (item: CoachDiscountDto): string =>
    item.duration === DiscountDuration.FirstPayments
      ? t('packages.discounts.duration.FirstPayments', { count: item.durationPayments ?? 0 })
      : t('packages.discounts.duration.EveryPayment');

  return (
    <Table className="min-w-240">
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.discount')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.value')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.appliesTo')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.valid')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.howLong')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.discounts.table.usedBy')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('packages.table.status')}</TableHead>
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
          isEmpty={discounts.length === 0}
          emptyKey="packages.discounts.empty"
          onRetry={onRetry}
        />
        {!isPending &&
          !isError &&
          discounts.map((item) => {
            const id = item.discountId ?? '';
            const name = item.name ?? '';
            const status = discountStatus(item, today);
            const archived = status === 'archived';
            return (
              <TableRow
                key={id}
                className={archived ? 'border-line' : 'cursor-pointer border-line'}
                onClick={archived ? undefined : () => onEdit(item)}
              >
                <TableCell className={CELL_CLASS}>
                  <div className="flex items-center gap-3">
                    <CatalogTile muted={status !== 'active'}>
                      <Tag className="size-4.5" aria-hidden="true" />
                    </CatalogTile>
                    {archived ? (
                      <span className="max-w-80 truncate text-copy font-semibold text-ink">{name}</span>
                    ) : (
                      <button
                        type="button"
                        className="max-w-80 truncate text-left text-copy font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(item);
                        }}
                      >
                        {name}
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-copy font-semibold text-ink`}>{valueLabel(item)}</TableCell>
                <TableCell className={CELL_TEXT_CLASS}>{appliesToLabel(item)}</TableCell>
                <TableCell className={CELL_TEXT_CLASS}>{validLabel(item)}</TableCell>
                <TableCell className={CELL_TEXT_CLASS}>{durationLabel(item)}</TableCell>
                <TableCell className={CELL_TEXT_CLASS}>
                  {t('packages.table.clientCount', { count: item.usedByCount ?? 0 })}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <StatusBadge status={status} />
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
