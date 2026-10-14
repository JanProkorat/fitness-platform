import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { formatCalendarDate, upcomingMondays } from '@/components/client-plan-editor/clientPlanDates';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  id: string;
  value: string | undefined;
  disabled: boolean;
  /** Why the picker is disabled, shown as the tooltip. */
  disabledTitle?: string;
  onChange: (value: string) => void;
}

/** A popover listing the upcoming Mondays; the server only accepts a Monday that is not in the past. */
export default function StartDatePicker({ id, value, disabled, disabledTitle, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const mondays = useMemo(() => {
    const list = upcomingMondays();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          data-testid="plan-start-date"
          disabled={disabled}
          title={disabled ? disabledTitle : undefined}
          aria-label={t('clientPlanEditor.info.startPick')}
          className="inline-flex h-10 w-full cursor-pointer items-center gap-2 rounded-field border border-input bg-background px-3 text-body font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn('min-w-0 flex-1 truncate text-left', !value && 'font-normal text-muted-foreground')}>
            {value ? formatCalendarDate(value, i18n.language) : t('clientPlanEditor.info.startPlaceholder')}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-72 w-(--radix-popover-trigger-width) flex-col gap-0.5 overflow-y-auto p-1.5">
        {mondays.map((monday) => {
          const selected = monday === value;
          return (
            <button
              key={monday}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onChange(monday);
                setOpen(false);
              }}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-md px-2.5 text-left text-body outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                selected ? 'bg-ink font-semibold text-primary-foreground' : 'text-ink hover:bg-muted',
              )}
            >
              {formatCalendarDate(monday, i18n.language)}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
