import { useTranslation } from 'react-i18next';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/hooks/useViewMode';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const OPTIONS = [
  { mode: 'grid', Icon: LayoutGrid, labelKey: 'library.viewMode.grid' },
  { mode: 'list', Icon: List, labelKey: 'library.viewMode.list' },
] as const;

/** Icon pair that switches a library page between its card grid and its table. */
export default function ViewModeToggle({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('library.viewMode.label')}
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-card p-0.5"
    >
      {OPTIONS.map(({ mode, Icon, labelKey }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          aria-label={t(labelKey)}
          title={t(labelKey)}
          onClick={() => onChange(mode)}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring',
            value === mode && 'bg-muted text-ink',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
