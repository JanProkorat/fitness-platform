import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface Props {
  /** Row label above the line, for the button's accessible name. */
  above: string;
  /** Row label below the line. */
  below: string;
  onInsert: () => void;
}

/**
 * A line across the gap between two meals with a + button at its left end; both show on hover and on
 * keyboard focus. Sits in an absolutely positioned strip that fills the gap above its (relative) parent,
 * so showing it moves nothing.
 */
export default function MealRowInsertLine({ above, below, onInsert }: Props) {
  const { t } = useTranslation();
  const label = t('planEditor.insertMeal.aria', { above, below });

  return (
    <span
      data-testid="meal-insert-line"
      data-no-drag
      className="group/insert absolute inset-x-0 -top-3 z-20 flex h-3 items-center"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-0.5 bg-primary opacity-0 group-focus-within/insert:opacity-100 group-hover/insert:opacity-100"
      />
      <span className="sticky left-0 flex items-center">
        <button
          type="button"
          data-testid="meal-insert-button"
          data-no-drag
          aria-label={label}
          title={label}
          onClick={(event) => {
            event.stopPropagation();
            onInsert();
          }}
          className="relative flex size-5 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 outline-none group-focus-within/insert:opacity-100 group-hover/insert:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-3" aria-hidden="true" />
        </button>
      </span>
    </span>
  );
}
