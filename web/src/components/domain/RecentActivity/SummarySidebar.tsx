import { ThisMonthCard } from './ThisMonthCard';
import { TopPrCard } from './TopPrCard';
import { ThisWeekCard } from './ThisWeekCard';
import type {
  ThisMonthAggregates,
  TopPrRecord,
  ThisWeekAggregates,
} from './useRecentActivityAggregates';

interface SummarySidebarProps {
  thisMonth: ThisMonthAggregates;
  topPr: TopPrRecord | null;
  thisWeek: ThisWeekAggregates;
  locale: 'cs' | 'en' | 'de';
}

export function SummarySidebar({
  thisMonth,
  topPr,
  thisWeek,
  locale,
}: SummarySidebarProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <ThisMonthCard data={thisMonth} />
      <TopPrCard topPr={topPr} locale={locale} />
      <ThisWeekCard data={thisWeek} />
    </div>
  );
}
