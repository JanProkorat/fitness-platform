import { cn } from '@/lib/cn';

interface StatBlock {
  label: string;
  value: string | number;
  valueColor?: string;
  sub?: string;
}

interface StatsGridProps {
  stats: StatBlock[];
  columns?: number;
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  return (
    <div
      className="grid gap-3 mb-4"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-3.5 px-4 rounded-md border border-border"
        >
          <div className="text-[11px] text-text3 font-medium uppercase tracking-[0.04em] mb-[5px]">
            {stat.label}
          </div>
          <div
            className={cn(
              'text-[22px] font-bold tracking-tight leading-none',
              typeof stat.valueColor === 'string' &&
                stat.valueColor.startsWith('#') === false &&
                stat.valueColor,
            )}
            style={
              typeof stat.valueColor === 'string' && stat.valueColor.startsWith('#')
                ? { color: stat.valueColor }
                : undefined
            }
          >
            {stat.value}
          </div>
          {stat.sub && (
            <div className="text-xs text-text3 mt-[3px]">{stat.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
